// Resolve the campaign language before menus and the battle renderer start.
(() => {
  const url = new URL(location.href);
  let language = url.searchParams.get('lang');
  try { language ||= localStorage.getItem('crunch-flow-language'); } catch {}
  const en = language === 'en';
  const strings = {
    'パキッ、ぷるん、サクッ。':'Snap. Jiggle. Crunch.',
    '遊ぶ':'Play','ASMR図鑑':'ASMR Book','設定':'Settings','キャラクター':'Characters',
    '‹ 戻る':'‹ Back','ほかの攻撃方法':'More moves','ステージ':'Stage','‹ キャラクター':'‹ Characters',
    '‹ タイトル':'‹ Title','単体':'Single','複数配置':'Group','連続供給':'Continuous',
    '撮影モード':'Film mode','HUD非表示・連続供給・素材音主役（縦型動画向け）':'Hide the HUD and keep materials flowing.',
    '背景':'Backdrop','無地':'Plain','成長段階':'Power level','キャラクターを選ぶ':'Choose a character',
    'キャラクターを選ぶ ›':'Choose a character ›','もう一度':'Retry','ステージへ':'Stages','タイトルへ':'Title',
    '破壊の跡を見る':'View the aftermath','破壊の跡':'Aftermath','画像を保存':'Save image','‹ 結果に戻る':'‹ Results',
    '‹ 撮影に戻る':'‹ Film mode','効果音':'Sound effects','音量':'Volume','画面の揺れ・ズーム':'Camera shake and zoom',
    '閉じる':'Close','プレイを終了する':'End run','撃破':'Broken','侵入':'Escaped','一時停止':'Pause',
    '素材を壊すプレイエリア':'Material play area','ボスの残り耐久':'Boss durability','メインメニュー':'Main menu',
    '撮影モードを終了':'Exit film mode','キャラクター選択':'Character selection','素材の置き方':'Material layout',
    'スタジオを準備中…':'Preparing the studio…','キャラ変更':'Switch hero','置き直す':'Refill',
    '撮影モードを始める ›':'Start filming ›','フリープレイを始める ›':'Start free play ›','ステージを選ぶ ›':'Choose a stage ›',
    '次のステージ ›':'Next stage ›','図鑑で遊ぶ ›':'Open the book ›','もう一度挑戦 ›':'Try again ›',
    '最大連続破壊':'Best chain','到達レベル':'Final level','強化なし':'No upgrades','画像を保存できませんでした':'Could not save the image',
    '素材を味わう':'First touch','隊形を崩す':'Break the formation','無双':'Rampage','広がる隊形をまとめて砕く':'Sweep through the crowd',
    '巨大素材の解体':'Boss incoming','外層から順に砕いてコアを壊せ！':'Break through to the core!',
    '外殻':'Shell','内層':'Inner layer','コア':'Core','厚い素材':'Thick material','断面が見えるまで何度か削る':'Strike again to expose the cut',
    '外殻クラッシュ！':'Shell shattered!','コア露出!!':'Core exposed!','PHASE 2 · 内層露出':'PHASE 2 · Inner layer',
    '脈動する内層と零れる塊をまとめて砕け！':'Crush the inner layer and loose pieces!',
    'FINAL PHASE · コア出現':'FINAL PHASE · Core exposed','亀裂を広げてフィナーレへ！':'Split the core to finish!',
    'コアに亀裂！':'Core cracked!','深くひび割れた！':'Deep fracture!','崩壊寸前!!':'One more push!',
    '止め押し':'Press','ゆっくり圧延':'Slow roll','ひと転がし':'Quick roll'
  };
  const t = text => en ? strings[text] ?? text : text;
  window.StudioLanguage = { en, t };
  document.getElementById('language').onclick = () => {
    const next = en ? 'ja' : 'en';
    try { localStorage.setItem('crunch-flow-language', next); } catch {}
    url.searchParams.set('lang', next);
    location.replace(url.href);
  };
  if (!en) return;
  document.documentElement.lang = 'en';
  StudioContent.festival.bossName = 'Eightfold Crown';
  const toggle = document.getElementById('language');
  toggle.lang = 'ja';
  toggle.textContent = '日本語';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, key = node.data.trim();
    if (Object.hasOwn(strings, key)) node.data = node.data.replace(key, strings[key]);
  }
  for (const el of document.querySelectorAll('[aria-label],[title]')) {
    for (const attr of ['aria-label','title']) if (el.hasAttribute(attr)) el.setAttribute(attr, t(el.getAttribute(attr)));
  }
  const heroes = {
    slasher:['Swipe across the material','Hold for a sweeping slash.'],
    crusher:['Tap the material','Flick sideways for a ricochet. Hold for a crushing finish.'],
    caster:['Circle the material, then lift','Tap to cast or hold to draw materials in.'],
    spinner:['Keep circling the material','Hold to unleash a whirlwind.'],
    roller:['Trace slowly over the material','Stay still to press deeper. Roll back over the imprint.']
  };
  for (const [id,[gesture,help]] of Object.entries(heroes)) {
    StudioContent.heroes[id].gesture[1] = gesture;
    StudioContent.heroes[id].help = help;
  }
  const materials = [
    ['Wax','Cream Crown','Snap, squish','Overlapping wax arches'],
    ['Jelly','Prism Jelly','Wobble, pop','Wobbling clusters'],
    ['Soap','Soap Jewel','Slice, crumble','Neat rows of soap'],
    ['Chalk','Pastel Castle','Crack, dust','Tall chalk stacks'],
    ['Kinetic sand','Dune King','Scrape, sift','Rolling dunes'],
    ['Sponge','Bubble King','Squeeze, drip','Heavy blocks'],
    ['Beaded slime','Candy Bead Core','Stretch, crunch','Twisting bead ribbons'],
    ['Crystal candy','Amber Crystal','Crackle, crunch','Branching crystal veins']
  ];
  for (const stage of StudioContent.stages) {
    const [name,boss,sound,formation] = materials[stage.n-1];
    Object.assign(LAB.combat.stages.MATERIALS[stage.mat], {jp:name,sound});
    stage.bossName = boss;
    StudioFormations.materials[stage.mat][1] = formation;
  }
  const upgrades = {wide:'Wider reach',wave:'Shockwave',double:'Double strike',rush:'Rush',blast:'Knockback',
    quake:'Aftershock',chain:'Chain lightning',blades:'Four blades',gale:'Vortex',heavy:'Heavy drum',gather:'Gathering fins'};
  for (const group of Object.values(LAB.combat.UPGRADES)) {
    for (const upgrade of group) upgrade.name = upgrades[upgrade.id] || upgrade.name;
  }
})();
