"""필름코리아 경기 로케이션 API를 받아 site/data/filmkorea.json 복사본을 만든다.

사이트는 평소 서버(Apps Script)가 대신 받아 온 최신 데이터를 쓰고, 서버가 안 될 때만 이 복사본을 보여 준다.
거르는 규칙은 site/js/core.js 의 fkClean 과 같다(경기도, 필름코리아 사진·상세 주소가 있는 곳만, 필요한 항목만).
사용: python -I pipeline/build_filmkorea.py [저장할 파일 경로]
"""
import datetime
import json
import pathlib
import re
import sys
import urllib.request

API = 'https://filmkorea.or.kr/api/ggfc_api.jsp'
IMG = re.compile(r'^https://filmkorea\.ecn\.cdn\.infralab\.net/[A-Za-z0-9_\-/.]+$')
VIEW = re.compile(r'^https://filmkorea\.or\.kr/location/location_view\.jsp\?id=\d+$')


def s(v, n):
    return re.sub(r'[\x00-\x1f]', ' ', v).strip()[:n] if isinstance(v, str) else ''


def clean(raw):
    out = []
    for r in raw if isinstance(raw, list) else []:
        if not isinstance(r, dict) or s(r.get('sd_nm'), 20) != '경기도':
            continue
        try:
            lid = int(r.get('location_id') or 0)
        except (TypeError, ValueError):
            lid = 0
        p = {
            'id': lid, 'name': s(r.get('location_nm'), 60), 'sdg': s(r.get('sdg_nm'), 30),
            'img': s(r.get('image_url'), 300), 'url': s(r.get('view_url'), 200),
            'tags': [t for t in (s(x, 12) for x in s(r.get('hashtag'), 200).split(',')) if t][:4],
            'c1': s(r.get('category01_nm'), 30), 'c2': s(r.get('category02_nm'), 30), 'c3': s(r.get('category03_nm'), 30),
        }
        if p['id'] and p['name'] and IMG.match(p['img']) and VIEW.match(p['url']):
            out.append(p)
    return out


def main():
    # 출력 파일은 첫 번째 인자로 바꿀 수 있다(GitHub 자동 갱신에서 씀). 없으면 site/data/filmkorea.json
    root = pathlib.Path(__file__).resolve().parent.parent
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'site' / 'data' / 'filmkorea.json'
    req = urllib.request.Request(API, headers={'User-Agent': 'gcon-location-hub/1.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = json.loads(r.read().decode('utf-8'))
    items = clean(raw)
    if not items:
        sys.exit('표시할 경기도 로케이션이 없어서 복사본을 만들지 않았습니다.')
    if out.exists():
        try:
            if json.loads(out.read_text(encoding='utf-8')).get('items') == items:
                print('바뀐 장소가 없어서 파일을 그대로 둡니다(%d건).' % len(items))
                return
        except (ValueError, OSError):
            pass
    meta = {'asOf': datetime.date.today().isoformat(), 'count': len(items), 'source': '필름코리아(한국영상위원회)'}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({'meta': meta, 'items': items}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('받은 %d건 중 %d건을 저장했습니다: %s' % (len(raw), len(items), out))


if __name__ == '__main__':
    main()
