"""Check the deployable portfolio for broken local references and missing metadata."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path
        self.ids = set()
        self.references = []
        self.errors = []
        self.h1_count = 0
        self.has_title = False
        self.has_description = False
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            if attrs['id'] in self.ids:
                self.errors.append(f"Duplicate id: {attrs['id']}")
            self.ids.add(attrs['id'])
        if tag == 'h1':
            self.h1_count += 1
        if tag == 'title':
            self.has_title = True
        if tag == 'meta' and attrs.get('name') == 'description':
            self.has_description = bool(attrs.get('content'))
        if tag == 'img' and 'alt' not in attrs:
            self.errors.append('Image has no alt attribute')
        for attr in ('href', 'src'):
            if attrs.get(attr):
                self.references.append(attrs[attr])
        if tag == 'a' and attrs.get('target') == '_blank':
            if 'noopener' not in attrs.get('rel', '').split():
                self.errors.append('External new-tab link has no noopener')


pages = {path.name: Page(path) for path in ROOT.glob('*.html')}
errors = []
for name, page in pages.items():
    if page.h1_count != 1:
        page.errors.append(f'Expected one h1, found {page.h1_count}')
    if not page.has_title or not page.has_description:
        page.errors.append('Missing title or description')
    for reference in page.references:
        url = urlsplit(reference)
        if url.scheme or url.netloc:
            continue
        path = unquote(url.path)
        if path.startswith('/portfolio/'):
            path = path[len('/portfolio/'):]
        if path in ('', './'):
            target = page.path if not path else ROOT / 'index.html'
        else:
            target = ROOT / path
        if target.is_dir():
            target = target / 'index.html'
        if not target.is_file():
            page.errors.append(f'Broken reference: {reference}')
        elif url.fragment and target.suffix == '.html':
            target_page = pages.get(target.name)
            if target_page and unquote(url.fragment) not in target_page.ids:
                page.errors.append(f'Missing fragment: {reference}')
    errors.extend(f'{name}: {message}' for message in page.errors)
if errors:
    raise SystemExit('\n'.join(errors))
print(f'Validated {len(pages)} pages: links, fragments, images, metadata and headings.')
