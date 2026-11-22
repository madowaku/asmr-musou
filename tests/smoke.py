from playwright.sync_api import sync_playwright
from pathlib import Path

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content((root/'index.html').read_text())
    page.add_style_tag(content=(root/'style.css').read_text())
    page.add_script_tag(content=(root/'game.js').read_text())
    page.wait_for_timeout(300)
    page.screenshot(path=str(root/'menu-preview.png'))
    assert page.title()=='ASMR MUSOU | バリぷにラッシュ'
    page.locator('#start').click()
    page.wait_for_timeout(300)
    state=page.evaluate('window.__asmrTest.getState()')
    assert state['state']=='play' and len(state['enemies'])>=7,state
    # Repeat first wax enough times to crack its shell and defeat it.
    e=next(e for e in state['enemies'] if e['type']=='wax')
    for i in range(3):
        newest=page.evaluate('window.__asmrTest.getState()')
        target=next(e2 for e2 in newest['enemies'] if e2['id']==e['id'])
        page.evaluate('({x,y}) => window.__asmrTest.hitAt(x,y)',{'x':target['x'],'y':target['y']})
        page.wait_for_timeout(170)
    state=page.evaluate('window.__asmrTest.getState()')
    assert state['kills']>=1,state
    assert state['score']>=100,state
    # Hold gesture crushes a jelly toy.
    current=page.evaluate('window.__asmrTest.getState()')
    jelly=next((j for j in current['enemies'] if j['type']=='jelly'),None)
    if jelly:
        box=page.locator('#game').bounding_box()
        px=box['x']+jelly['x']*box['width']/720
        py=box['y']+jelly['y']*box['height']/1280
        before=current['kills']
        page.mouse.move(px,py)
        page.mouse.down()
        page.wait_for_timeout(820)
        page.mouse.up()
        assert page.evaluate('window.__asmrTest.getState().kills')>before,'long press failed'
    # Check that the responsive canvas still fills the game frame.
    page.screenshot(path=str(root/'play-preview.png'))
    page.evaluate('window.__asmrTest.end()')
    assert page.locator('#result').is_visible()
    assert page.locator('#final-score').inner_text()!='0'
    assert not errors,errors
    print('PASS: menu, start, attacks, hold, score, results and no browser errors')
    browser.close()
