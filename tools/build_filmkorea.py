"""필름코리아 경기 로케이션 API를 받아 site/data/filmkorea.json 복사본과 가벼운 썸네일을 만든다.

사이트는 이 복사본(data/filmkorea.json)과 썸네일(img/fk/번호.jpg)을 읽어 보여 준다.
GitHub가 매일 새벽 이 스크립트를 돌려 새로 만든다(.github/workflows/filmkorea.yml).
- 거르는 규칙: 경기도이면서 필름코리아 사진·상세 주소가 있는 곳만, 화면에 필요한 항목만 남긴다(화면에서도 Core.fkValid로 한 번 더 점검).
- 썸네일: 필름코리아 원본 사진(한 장 약 2MB)을 가로 720px JPEG(수십 KB)로 줄여 저장한다. 사진 속 위치·기기 정보는 담기지 않는다.
  원본 주소가 그대로면 다시 받지 않고, 목록에서 빠진 장소의 썸네일은 지운다. 사진을 내려받지 못한 장소(원본이 깨진 곳 등)는 목록에서 뺀다.
사용: python -I pipeline/build_filmkorea.py [저장할 json 경로]   (썸네일은 json 위치 기준 ../img/fk/ 에 저장)
"""
import datetime
import io
import json
import pathlib
import re
import sys
import urllib.request

API = 'https://filmkorea.or.kr/api/ggfc_api.jsp'
IMG = re.compile(r'^https://filmkorea\.ecn\.cdn\.infralab\.net/[A-Za-z0-9_\-/.]+$')
VIEW = re.compile(r'^https://filmkorea\.or\.kr/location/location_view\.jsp\?id=\d+$')
THUMB_W = 720          # 썸네일 가로 크기(카드가 가장 크게 보여도 이 정도면 선명하다)
THUMB_Q = 78           # JPEG 품질
MAX_DOWNLOAD = 25 * 1024 * 1024
UA = {'User-Agent': 'gcon-location-hub/1.0'}


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


def make_thumb(data, width=THUMB_W, quality=THUMB_Q):
    """원본 이미지 바이트 -> 가로 width 이하의 JPEG 바이트(EXIF 등 부가 정보 없이)."""
    from PIL import Image
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert('RGB')
    if im.width > width:
        im = im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def download(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read(MAX_DOWNLOAD + 1)
    if len(data) > MAX_DOWNLOAD:
        raise ValueError('사진이 너무 큽니다')
    return data


def build_thumbs(items, out):
    """items 의 사진을 썸네일로 바꾼다(사진을 못 받은 장소는 items 에서 뺀다). 원본 주소는 'o'에 남겨 두어 바뀌었는지 알아본다."""
    img_dir = out.parent.parent / 'img' / 'fk'
    img_dir.mkdir(parents=True, exist_ok=True)
    prev = {}
    if out.exists():
        try:
            prev = {p['id']: p for p in json.loads(out.read_text(encoding='utf-8')).get('items', [])}
        except (ValueError, OSError, KeyError, TypeError):
            prev = {}
    keep, made, reused, failed, good = set(), 0, 0, 0, []
    for p in items:
        orig, name = p['img'], '%d.jpg' % p['id']
        dest, old = img_dir / name, prev.get(p['id'])
        if old and old.get('o') == orig and dest.exists():
            p['img'], p['o'] = 'img/fk/' + name, orig
            keep.add(name)
            good.append(p)
            reused += 1
            continue
        try:
            dest.write_bytes(make_thumb(download(orig)))
            p['img'], p['o'] = 'img/fk/' + name, orig
            keep.add(name)
            good.append(p)
            made += 1
        except Exception as e:  # 한 장이 실패해도 나머지는 계속한다. 이 장소는 이번 목록에서 뺀다(다음에 다시 시도).
            print('  사진을 받지 못해 뺍니다: %s %s' % (p['id'], e))
            failed += 1
    for f in img_dir.glob('*.jpg'):
        if f.name not in keep:
            f.unlink()
    total = sum((img_dir / n).stat().st_size for n in keep) // 1024
    print('썸네일: 새로 %d장, 그대로 %d장, 못 받음 %d장 (전체 %dKB)' % (made, reused, failed, total))
    items[:] = good


def main():
    # 출력 파일은 첫 번째 인자로 바꿀 수 있다(GitHub 자동 갱신에서 씀). 없으면 site/data/filmkorea.json
    root = pathlib.Path(__file__).resolve().parent.parent
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'site' / 'data' / 'filmkorea.json'
    req = urllib.request.Request(API, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = json.loads(r.read().decode('utf-8'))
    items = clean(raw)
    if not items:
        sys.exit('표시할 경기도 로케이션이 없어서 복사본을 만들지 않았습니다.')
    old_items = None
    if out.exists():
        try:
            old_items = json.loads(out.read_text(encoding='utf-8')).get('items')
        except (ValueError, OSError):
            old_items = None
    build_thumbs(items, out)
    if old_items == items:
        print('바뀐 장소가 없어서 파일을 그대로 둡니다(%d건).' % len(items))
        return
    meta = {'asOf': datetime.date.today().isoformat(), 'count': len(items), 'source': '필름코리아(한국영상위원회)'}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({'meta': meta, 'items': items}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('받은 %d건 중 %d건을 저장했습니다: %s' % (len(raw), len(items), out))


if __name__ == '__main__':
    main()
