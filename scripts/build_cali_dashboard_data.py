"""Construye los agregados seguros del módulo Cali.

DESACTUALIZADO respecto al lote de datos del 2026-09-01 que hay en data/.
Ese lote usa identificadores de Google Places en `place_id`, ya no emite
`tipo_inmueble`, `recomendaciones`, `rud_match_methods` ni
`rud_match_confidence` en el GeoJSON, y añade `meta.batchDate`. Este script
sigue generando el esquema anterior: revísalo antes de volver a ejecutarlo.

Uso desde la raíz del repositorio:
    python scripts/build_cali_dashboard_data.py --input-dir ./input --output-dir .

Escribe dos artefactos, relativos a --output-dir:
    data/cali_dashboard_data.js      window.CALI_DATA (agregados de la sección Cali)
    data/geo/cali_map_internal.geojson   capa de puntos del mapa interno

Los archivos de entrada no forman parte del repositorio. El resultado contiene
indicadores agregados y direcciones para el mapa interno, pero nunca documentos,
nombres, teléfonos, correos, firmas ni credenciales.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd


AGE_LABELS = ['0–5', '6–12', '13–17', '18–24', '25–29', '30–44', '45–59', '60–64', '65+']
STATE_LABELS = ['Averiado', 'No Habitable', 'Habitable', 'Destruido', 'No informa']
GENDER_LABELS = ['Femenino', 'Masculino', 'Transgénero', 'No informa']
ETHNICITY_LABELS = [
    'No Aplica', 'Negro(a), Mulato(a), Afrodescendiente, Afrocolombiano(a)',
    'Indígena', 'Raizal', 'Palenquero(a)', 'Gitano-ROM', 'No informa',
]
TENURE_LABELS = ['Propietario', 'Arrendatario', 'Ocupante', 'Poseedor', 'No informa']
DAMAGE_RANK = {'sin_dano': 0, 'bajo': 1, 'medio': 2, 'alto': 3}
SEVERITY_RANK = {'sin_dano': 0, 'bajo': 1, 'medio': 2, 'medio_alto': 3, 'alto': 4}


def normalize(value: object) -> str:
    if value is None:
        return ''
    try:
        if pd.isna(value):
            return ''
    except (TypeError, ValueError):
        pass
    text = '' if value is None else str(value).upper()
    text = ''.join(ch for ch in unicodedata.normalize('NFD', text) if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^A-Z0-9]', '', text)


def normalize_document(value: object) -> str:
    if value is None:
        return ''
    try:
        if pd.isna(value):
            return ''
    except (TypeError, ValueError):
        pass
    text = str(value).strip().upper()
    text = re.sub(r'\.0+$', '', text)
    text = re.sub(r'[^A-Z0-9]', '', text)
    if text.isdigit():
        text = text.lstrip('0') or '0'
    return text


def first_token(value: object, default: str = 'No informa') -> str:
    if value is None:
        return default
    try:
        if pd.isna(value):
            return default
    except (TypeError, ValueError):
        pass
    text = str(value).strip().split(';')[0].strip()
    return text if text and text.lower() not in {'no informa', 'n-a', 'na'} else default


def road_key(value: object) -> str:
    text = '' if value is None else str(value).upper()
    text = ''.join(ch for ch in unicodedata.normalize('NFD', text) if unicodedata.category(ch) != 'Mn')
    for pattern, replacement in [
        (r'\bCARRERA\b|\bCRA\.?\b|\bCARR\.?\b', 'CR'),
        (r'\bCALLE\b|\bCL\.?\b', 'CL'),
        (r'\bAVENIDA\b|\bAV\.?\b', 'AV'),
        (r'\bDIAGONAL\b|\bDG\.?\b', 'DG'),
        (r'\bTRANSVERSAL\b|\bTV\.?\b', 'TV'),
    ]:
        text = re.sub(pattern, replacement, text)
    match = re.search(r'\b(CR|CL|AV|DG|TV)\s*([0-9A-Z]+).*?(?:#|NUM|NO)?\s*([0-9A-Z]+)\s*[- ]\s*([0-9A-Z]+)', text)
    if match:
        return f'{match.group(1)}{match.group(2)}-{match.group(3)}-{match.group(4)}'
    match = re.search(r'\b(CR|CL|AV|DG|TV)\s*([0-9A-Z]+)\s+([0-9A-Z]+)\s+([0-9A-Z]+)', text)
    return f'{match.group(1)}{match.group(2)}-{match.group(3)}-{match.group(4)}' if match else ''


def safe_json(path: Path) -> list[dict]:
    value = json.loads(path.read_text(encoding='utf-8'))
    if isinstance(value, dict) and value.get('type') == 'FeatureCollection':
        return value.get('features', [])
    return value if isinstance(value, list) else []


def prop(feature: dict, key: str):
    return (feature.get('properties') or {}).get(key) if feature.get('type') == 'Feature' else feature.get(key)


def feature_coord(feature: dict):
    if feature.get('type') == 'Feature':
        coordinates = (feature.get('geometry') or {}).get('coordinates') or []
        if len(coordinates) >= 2:
            try:
                return float(coordinates[0]), float(coordinates[1])
            except (TypeError, ValueError):
                return None
    try:
        return float(feature['lng']), float(feature['lat'])
    except (KeyError, TypeError, ValueError):
        return None


def valid_cali_coord(coordinate) -> bool:
    if not coordinate:
        return False
    lng, lat = coordinate
    return -77.2 <= lng <= -76.2 and 3.0 <= lat <= 4.0


def count_items(series: pd.Series, labels: list[str] | None = None) -> list[dict]:
    values = series.astype('string').fillna('No informa').str.strip().replace({'': 'No informa', 'No Informa': 'No informa'})
    counter = values.value_counts(dropna=False)
    if labels is not None:
        counter = counter.reindex(labels, fill_value=0)
    return [{'label': str(label), 'value': int(value)} for label, value in counter.items()]


def parse_dates(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors='coerce')
    parsed = pd.to_datetime(series, errors='coerce')
    serial = numeric.notna() & numeric.between(1, 100000)
    parsed.loc[serial] = pd.to_datetime(numeric[serial], unit='D', origin='1899-12-30')
    return parsed


def distribution(frame: pd.DataFrame) -> dict:
    if frame.empty:
        return {'records': 0, 'uniqueDocs': 0, 'households': 0, 'stateKnown': 0, 'serious': 0, 'seriousPctKnown': 0, 'women': 0, 'minors': 0, 'older65': 0, 'afro': 0, 'indigenous': 0, 'status': [], 'gender': [], 'ethnicity': [], 'age': [], 'tenure': [], 'property': [], 'kinship': []}
    state = count_items(frame['estado'], STATE_LABELS)
    state_known = sum(row['value'] for row in state if row['label'] != 'No informa')
    serious = sum(row['value'] for row in state if row['label'] in {'No Habitable', 'Destruido'})
    unique_docs = int(frame.loc[frame['doc_key'].ne(''), 'doc_key'].nunique())
    households = int(frame['household_key'].nunique())
    return {
        'records': int(len(frame)),
        'uniqueDocs': unique_docs,
        'households': households,
        'stateKnown': int(state_known),
        'serious': int(serious),
        'seriousPctKnown': round(serious / state_known * 100, 1) if state_known else 0,
        'women': int((frame['genero'] == 'Femenino').sum()),
        'minors': int(frame['age_group'].isin(['0–5', '6–12', '13–17']).sum()),
        'older65': int((frame['age_group'] == '65+').sum()),
        'afro': int(frame['etnia'].str.contains('Afro|Negro|Mulato', case=False, na=False).sum()),
        'indigenous': int((frame['etnia'] == 'Indígena').sum()),
        'status': state,
        'gender': count_items(frame['genero'], GENDER_LABELS),
        'ethnicity': count_items(frame['etnia'], ETHNICITY_LABELS),
        'age': count_items(frame['age_group'], AGE_LABELS),
        'tenure': count_items(frame['tenencia'], TENURE_LABELS),
        'property': count_items(frame['bien']),
        'kinship': count_items(frame['parentesco']),
    }


def unique_text(values) -> str:
    return ', '.join(sorted({str(value).strip() for value in values if value not in (None, '')}))


def build(args):
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    # El dashboard espera los agregados en data/ y las capas en data/geo/.
    data_dir = output_dir / 'data'
    geo_dir = data_dir / 'geo'
    geo_dir.mkdir(parents=True, exist_ok=True)

    rud = pd.read_excel(input_dir / 'RUD VALLE DEL CAUCA - SISMO.xlsx')
    rud = rud[rud['municipio'].astype('string').str.upper().eq('CALI')].copy()
    for column in rud.columns:
        if rud[column].dtype == 'object':
            rud[column] = rud[column].astype('string').str.strip()

    rud['estado'] = rud['estado_bien'].map(first_token)
    rud['tenencia'] = rud['tenencia_bien'].map(first_token)
    rud['bien'] = rud['bienes'].map(first_token)
    rud['genero'] = rud['nombre_genero'].fillna('No informa')
    rud['etnia'] = rud['etnia'].map(first_token)
    rud['parentesco'] = rud['parentesco'].map(first_token)
    birth = parse_dates(rud['fecha_nacimiento'])
    age = (pd.Timestamp('2026-08-10') - birth).dt.days / 365.2425
    rud['age_group'] = pd.cut(age.where(age.between(0, 110)), [-1, 5, 12, 17, 24, 29, 44, 59, 64, 200], labels=AGE_LABELS)
    rud['doc_key'] = rud.apply(lambda row: normalize(row['tipo_documento']) + '|' + normalize_document(row['numero_documento']), axis=1)
    rud.loc[rud['doc_key'].eq('|'), 'doc_key'] = ''
    form_key = rud['numero_formulario'].fillna('').astype('string').replace('', pd.NA)
    fallback_key = pd.Series(['row-' + str(index) for index in rud.index], index=rud.index, dtype='string')
    rud['household_key'] = form_key.where(form_key.notna(), fallback_key)
    # A corregimiento identifies a rural record. vereda_bien is retained as the
    # operational area label because it contains neighbourhood/sector labels in this RUD.
    rud['zone'] = rud['corregimiento_bien'].map(lambda value: 'Rural' if normalize(value) not in {'', 'NOAPLICA', 'NOINFORMA'} else 'Urbana')
    rud['area'] = rud['vereda_bien'].map(lambda value: first_token(value, 'Sin información').upper())
    rud['corregimiento'] = rud['corregimiento_bien'].map(lambda value: first_token(value, 'Sin información').upper())
    rud['address_key'] = rud['direccion_bien'].map(normalize)
    rud['address_text'] = rud['direccion_bien'].fillna('').astype('string').str.strip()
    rud['road_key'] = rud['address_text'].map(road_key)

    evaluations = safe_json(input_dir / 'evaluationsV2.geojson')
    places = safe_json(input_dir / 'placesV2.geojson')
    reports = safe_json(input_dir / 'reporte.json')
    paso1 = safe_json(input_dir / 'evaluacion_paso1.json')
    paso2 = safe_json(input_dir / 'evaluacion_paso2.json')
    citizens = safe_json(input_dir / 'ciudadano.json')

    canonical_places = {}
    place_refs = defaultdict(set)
    for feature in places:
        pid = prop(feature, 'id')
        coordinate = feature_coord(feature)
        if not pid or prop(feature, 'dedupedInto') is not None or not valid_cali_coord(coordinate):
            continue
        address = str(prop(feature, 'address') or '').strip()
        canonical_places[pid] = {
            'place_id': pid,
            'longitude': coordinate[0],
            'latitude': coordinate[1],
            'address': address,
            'place_report_count': int(prop(feature, 'reportCount') or 0),
            'placeId': prop(feature, 'placeId'),
        }
        if address:
            place_refs[('address', normalize(address))].add(pid)
    eval_by_place = defaultdict(list)
    for feature in evaluations:
        pid = prop(feature, 'place')
        coordinate = feature_coord(feature)
        if pid in canonical_places and valid_cali_coord(coordinate):
            eval_by_place[pid].append(feature)
            address = str(prop(feature, 'address') or '').strip()
            if address:
                place_refs[('address', normalize(address))].add(pid)

    # Deterministic address match. The dashboard exposes the confidence counts;
    # only unique candidates are linked automatically.
    rud['match_place_id'] = pd.NA
    rud['match_method'] = 'sin_coincidencia'
    rud['match_confidence'] = 'sin_coincidencia'
    for index, row in rud.iterrows():
        if not row['address_key'] or ';' in row['address_text']:
            continue
        candidates = place_refs.get(('address', row['address_key']), set())
        if len(candidates) == 1:
            rud.at[index, 'match_place_id'] = next(iter(candidates))
            rud.at[index, 'match_method'] = 'direccion_normalizada'
            rud.at[index, 'match_confidence'] = 'alta'

    # Preserve the previously audited road + area rule for records whose exact
    # address spelling differs. It is deliberately conservative.
    road_area_index = defaultdict(set)
    for pid, place in canonical_places.items():
        address = place['address']
        road_area_index[(road_key(address), '')].add(pid)
        for evaluation in eval_by_place.get(pid, []):
            road_area_index[(road_key(str(prop(evaluation, 'address') or '')), normalize(prop(evaluation, 'barrio')))].add(pid)
    for index, row in rud[rud['match_place_id'].isna()].iterrows():
        area_key = normalize(row['area'])
        candidates = road_area_index.get((row['road_key'], area_key), set())
        if len(candidates) == 1:
            rud.at[index, 'match_place_id'] = next(iter(candidates))
            rud.at[index, 'match_method'] = 'nomenclatura_sector'
            rud.at[index, 'match_confidence'] = 'media'

    matched = rud[rud['match_place_id'].notna()].copy()

    # Counts by place and safe internal map properties. Addresses are retained
    # because this dashboard is intended for an authenticated internal use case.
    map_features = []
    for pid, place in sorted(canonical_places.items(), key=lambda item: (item[1]['latitude'], item[1]['longitude'])):
        evals = eval_by_place.get(pid, [])
        frame = matched[matched['match_place_id'].eq(pid)]
        damages = [str(prop(row, 'nivelDano')) for row in evals if prop(row, 'nivelDano')]
        severities = [str(prop(row, 'severidad')) for row in evals if prop(row, 'severidad')]
        eval_addresses = [str(prop(row, 'address')).strip() for row in evals if prop(row, 'address')]
        eval_areas = [str(prop(row, 'barrio')).strip() for row in evals if prop(row, 'barrio')]
        area = frame['area'].mode().iloc[0] if not frame.empty and not frame['area'].mode().empty else (eval_areas[0] if eval_areas else 'Sin información')
        zone = frame['zone'].mode().iloc[0] if not frame.empty and not frame['zone'].mode().empty else 'Urbana'
        properties = {
            'place_id': pid,
            'address': place['address'] or (eval_addresses[0] if eval_addresses else ''),
            'area': area,
            'zone': zone,
            'place_report_count': place['place_report_count'],
            'evaluation_count': len(evals),
            'nivel_dano_max': max(damages, key=lambda value: DAMAGE_RANK.get(value, -1)) if damages else None,
            'severidad_max': max(severities, key=lambda value: SEVERITY_RANK.get(value, -1)) if severities else None,
            'habitabilidad': unique_text(prop(row, 'habitabilidad') for row in evals),
            'tipo_inmueble': unique_text(prop(row, 'tipoInmueble') for row in evals),
            'recomendaciones': unique_text(item for row in evals for item in (prop(row, 'recomendaciones') or [])),
            'rud_records': int(len(frame)),
            'rud_unique_docs': int(frame.loc[frame['doc_key'].ne(''), 'doc_key'].nunique()),
            'rud_households': int(frame['household_key'].nunique()),
            'rud_women': int((frame['genero'] == 'Femenino').sum()),
            'rud_minors': int(frame['age_group'].isin(['0–5', '6–12', '13–17']).sum()),
            'rud_older65': int((frame['age_group'] == '65+').sum()),
            'rud_match_methods': unique_text(frame['match_method']),
            'rud_match_confidence': unique_text(frame['match_confidence']),
            'has_rud_match': bool(len(frame)),
        }
        map_features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [place['longitude'], place['latitude']]}, 'properties': properties})

    cali_rud = distribution(rud)
    cali_crossed = distribution(matched)
    area_views = {}
    for area, frame in rud.groupby('area'):
        if area == 'SIN INFORMACIÓN':
            area = 'Sin información'
        cross_frame = matched[matched['area'].eq(area.upper())] if area != 'Sin información' else matched[matched['area'].eq('SIN INFORMACIÓN')]
        area_views[str(area)] = {'zone': str(frame['zone'].mode().iloc[0]) if not frame['zone'].mode().empty else 'Urbana', 'rud': distribution(frame), 'crossed': distribution(cross_frame)}
    zone_views = {str(zone): {'rud': distribution(frame), 'crossed': distribution(matched[matched['zone'].eq(zone)])} for zone, frame in rud.groupby('zone')}

    citizen_docs = {normalize_document(row.get('cedula')) for row in citizens if normalize_document(row.get('cedula'))}
    rud_docs = {key.split('|', 1)[1] for key in rud['doc_key'] if key}
    rud_doc_counts = Counter(key.split('|', 1)[1] for key in rud['doc_key'] if key)
    citizen_matched = citizen_docs & rud_docs
    citizen_comparison = {'total': len(citizen_docs), 'matchedRudCali': len(citizen_matched), 'unmatchedRudCali': len(citizen_docs - rud_docs), 'coveragePct': round(len(citizen_matched) / len(citizen_docs) * 100, 1) if citizen_docs else 0}
    citizen_details = []
    for document in sorted(citizen_docs):
        citizen_details.append({
            'protectedId': 'C-' + hashlib.sha256(document.encode('utf-8')).hexdigest()[:10].upper(),
            'maskedDocument': '••••' + document[-4:] if len(document) >= 4 else '••••',
            'status': 'En RUD Cali' if document in rud_docs else 'Sin cruce en RUD Cali',
            'rudRecords': int(rud_doc_counts.get(document, 0)),
        })

    damage = count_items(pd.Series([prop(row, 'nivelDano') or 'Sin información' for row in evaluations]))
    severity = count_items(pd.Series([prop(row, 'severidad') or 'Sin información' for row in evaluations]))
    habitability = count_items(pd.Series([prop(row, 'habitabilidad') or 'Sin información' for row in evaluations]))
    property_types = count_items(pd.Series([prop(row, 'tipoInmueble') or 'Sin información' for row in evaluations]))
    methods = Counter(rud['match_method'])
    method_labels = [
        ('direccion_normalizada', 'Alta · dirección normalizada'),
        ('nomenclatura_sector', 'Media · nomenclatura + área'),
        ('sin_coincidencia', 'Sin coincidencia'),
    ]
    summary = {
        'meta': {'title': 'Cali · RUD, autoevaluaciones y visitas', 'event': 'Sismo · 10 de agosto de 2026', 'privacyNote': 'Agregados para dashboard interno. No incluye documentos, nombres, teléfonos, correos ni credenciales.'},
        'rud': cali_rud,
        'crossed': cali_crossed,
        'views': {'all': {'rud': cali_rud, 'crossed': cali_crossed}, 'zones': zone_views, 'areas': area_views},
        'match': {'rudRecords': len(rud), 'matchedRecords': len(matched), 'matchedPct': round(len(matched) / len(rud) * 100, 1) if len(rud) else 0, 'highRecords': int((rud['match_confidence'] == 'alta').sum()), 'mediumRecords': int((rud['match_confidence'] == 'media').sum()), 'unmatchedRecords': int(rud['match_place_id'].isna().sum()), 'methods': [{'label': label, 'value': int(methods.get(key, 0))} for key, label in method_labels]},
        'citizens': citizen_comparison | {'details': citizen_details},
        'coverage': {'addressRecords': int(rud['address_text'].ne('').sum()), 'addressCoveragePct': round(rud['address_text'].ne('').mean() * 100, 1), 'uniqueAddresses': int(rud.loc[rud['address_key'].ne(''), 'address_key'].nunique()), 'sectorRecords': int(rud['area'].ne('SIN INFORMACIÓN').sum()), 'sectorCoveragePct': round(rud['area'].ne('SIN INFORMACIÓN').mean() * 100, 1)},
        'sources': {'rudRecords': len(rud), 'citizenRecords': len(citizens), 'citizenReports': len(reports), 'step1': len(paso1), 'step2': len(paso2), 'structuralEvaluations': len(evaluations), 'places': len(places), 'canonicalMapPoints': len(map_features), 'evaluatedPlaces': sum(1 for value in eval_by_place.values() if value)},
        'evaluations': {'damage': damage, 'severity': severity, 'habitability': habitability, 'propertyTypes': property_types},
        'areas': sorted([{'label': label, 'zone': value['zone'], 'records': value['rud']['records'], 'matchedRecords': value['crossed']['records']} for label, value in area_views.items()], key=lambda row: row['records'], reverse=True),
        'zones': [{'label': label, 'records': value['rud']['records'], 'matchedRecords': value['crossed']['records']} for label, value in zone_views.items()],
        # `features` duplica cali_map_internal.geojson a proposito: es el
        # respaldo que usa el mapa cuando fetch no esta disponible (file://).
        'map': {'center': [3.4516, -76.532], 'features': map_features},
    }
    (data_dir / 'cali_dashboard_data.js').write_text('window.CALI_DATA = ' + json.dumps(summary, ensure_ascii=False, separators=(',', ':')) + ';', encoding='utf-8')
    (geo_dir / 'cali_map_internal.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': map_features}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'rud': len(rud), 'matched': len(matched), 'citizenMatched': len(citizen_matched), 'points': len(map_features)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', default='./input')
    parser.add_argument('--output-dir', default='.')
    build(parser.parse_args())
