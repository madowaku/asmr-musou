(function () {
  'use strict';
  window.StudioMenus = ({ L, C, G, Studio, progress, start, fillFree, cancel }) => {
    const $ = id => document.getElementById(id);
    const { heroes, stages } = Studio;
    const screens = Array.from(document.querySelectorAll('.screen'));
    let freeSelect = false, material = null, settingsFrom = null, practice = false;
    const practiceHero = C.iai ? 'slasher' : 'roller';
    const practiceTitle = C.iai ? '居合の練習' : 'ROLLERの練習';
    const rollerHelp = 'ゆっくりで深く。素早くで削りかす。止めて芯を押す。';

    function view(id, focus = true) {
      for (const section of screens) section.hidden = section.id !== id;
      const active = id === 'play';
      $('hud').hidden = $('play-footer').hidden = !active;
      $('arena').classList.toggle('playing', active);
      if (focus && !active) {
        const target = $(id)?.querySelector('h1,h2');
        if (target) {
          target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      }
    }

    const helpFor = id => id === 'slasher' && C.iai ? C.iai.help
      : id === 'roller' && C.rollerFeel ? rollerHelp : heroes[id].help;

    function paintHero() {
      const hero = heroes[progress.hero];
      const art = $('hero-art');
      art.src = Studio.portrait(progress.hero);
      $('hero-preview').style.setProperty('--hero', hero.color);
      $('hero-name').textContent = hero.name + '  ' + hero.jp;
      $('hero-help').textContent = helpFor(progress.hero);
      $('hero-confirm').textContent = freeSelect ? 'フリープレイを始める ›' : 'ステージを選ぶ ›';
      for (const button of $('hero-cards').querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.hero === progress.hero));
      }
    }

    function selectHero(free) {
      freeSelect = free;
      paintHero();
      view('select');
    }

    function card(stage, mode) {
      const book = mode === 'book';
      const available = book ? practice || Studio.learned(stage, progress) : Studio.unlocked(stage, progress);
      const button = document.createElement('button');
      button.className = 'stage-card';
      button.dataset.stage = stage.n;
      button.style.setProperty('--swatch', stage.colors[0]);
      button.disabled = !available;
      if (book) button.setAttribute('aria-pressed', String(stage === material));
      const image = document.createElement('img');
      image.src = L.tex('body/' + stage.mat + '_boss').src;
      image.alt = '';
      const info = document.createElement('div');
      const caption = document.createElement('small');
      caption.textContent = stage.name;
      const label = document.createElement('strong');
      label.textContent = L.combat.stages.MATERIALS[stage.mat].jp;
      const note = document.createElement('span');
      note.textContent = available
        ? (Studio.learned(stage, progress) && !book ? 'CLEAR · ' : '') + L.combat.stages.MATERIALS[stage.mat].sound
        : 'STAGE ' + (book ? stage.n : stage.n - 1) + ' クリアで解放';
      info.append(caption, label, note);
      button.append(image, info);
      if (book) button.addEventListener('click', () => {
        material = stage;
        $('book-confirm').disabled = false;
        for (const item of $('material-cards').querySelectorAll('button')) {
          item.setAttribute('aria-pressed', String(item === button));
        }
      });
      else button.addEventListener('click', () => launch(stage));
      return button;
    }

    function showStages() {
      $('stage-cards').replaceChildren(...stages.map(stage => card(stage, 'stage')));
      view('stages');
    }

    function showBook() {
      if (!material || (!practice && !Studio.learned(material, progress))) {
        material = practice ? stages[0] : stages.find(stage => Studio.learned(stage, progress)) || null;
      }
      $('book-heading').textContent = practice ? practiceTitle : 'ASMR図鑑';
      $('book-confirm').textContent = practice ? (C.iai ? 'この素材を斬る ›' : 'この素材を圧延する ›') : 'キャラクターを選ぶ ›';
      $('material-cards').replaceChildren(...stages.map(stage => card(stage, 'book')));
      $('book-confirm').disabled = !material;
      view('book');
    }

    function applySettings() {
      C.muted = !progress.sound;
      L.audio.setEnabled(progress.sound);
      L.audio.setMaster(progress.volume);
      if (!progress.volume) C.muted = true;
      $('sound-setting').checked = progress.sound;
      $('volume').value = Math.round(progress.volume * 100);
      $('motion').checked = progress.motion;
      $('arena').classList.toggle('calm', !progress.motion);
    }

    function syncSettings() {
      progress.sound = $('sound-setting').checked;
      progress.volume = Number($('volume').value) / 100;
      progress.motion = $('motion').checked;
      applySettings();
      Studio.save(progress);
      if (progress.sound) L.audio.unlock();
    }

    function settings(active, trigger) {
      settingsFrom = trigger;
      if (active) { G.paused = true; cancel(); }
      $('leave').hidden = !active;
      $('settings').hidden = false;
      document.querySelector('.screen:not([hidden])')?.setAttribute('inert', '');
      $('sound-setting').focus({ preventScroll: true });
    }

    function closeSettings(resume = true) {
      $('settings').hidden = true;
      for (const screen of screens) screen.removeAttribute('inert');
      if (resume && G.state === 'play' && !G.choice) G.paused = false;
      if (resume) settingsFrom?.focus({ preventScroll: true });
    }

    function launch(stage, free = null) {
      L.audio.unlock();
      start(progress.hero, stage, free);
    }

    function showTitle() {
      G.state = 'select';
      view('title');
    }

    function bind() {
      const buttons = Object.entries(heroes).map(([id, hero]) => {
        const button = document.createElement('button');
        button.dataset.hero = id;
        button.style.setProperty('--hero', hero.color);
        button.textContent = hero.jp;
        const image = document.createElement('img');
        image.src = window.StudioBattleArt['hero/' + id];
        image.alt = '';
        button.prepend(image);
        button.addEventListener('click', () => {
          progress.hero = id;
          Studio.save(progress);
          paintHero();
        });
        return button;
      });
      $('hero-cards').replaceChildren(...buttons);
      for (const id of ['slasher', 'crusher', 'caster', 'spinner', 'roller']) {
        const image = document.createElement('img');
        image.src = Studio.portrait(id);
        image.alt = '';
        $('title-art').append(image);
      }
      $('adventure').onclick = () => selectHero(false);
      $('collection').onclick = $('book-back').onclick = null;
      $('collection').onclick = () => { practice = false; showBook(); };
      if (C.rollerFeel || C.iai) {
        if (C.iai) $('roller-practice').textContent = practiceTitle + ' ›';
        $('roller-practice').hidden = false;
        $('roller-baseline').hidden = false;
        $('roller-practice').onclick = () => {
          practice = true;
          if(C.iai)document.querySelector('input[value="group"]').checked = true;
          showBook();
        };
      }
      $('hero-back').onclick = () => freeSelect ? showBook() : showTitle();
      $('stage-back').onclick = () => selectHero(false);
      $('book-back').onclick = showTitle;
      $('book-confirm').onclick = () => {
        if (!material) return;
        if (practice) {
          L.audio.unlock();
          start(practiceHero, material, document.querySelector('input[name="layout"]:checked').value, C.iai ? 'iai' : 'roller');
        } else selectHero(true);
      };
      $('hero-confirm').onclick = () => {
        if (freeSelect && material) launch(material, document.querySelector('input[name="layout"]:checked').value);
        else showStages();
      };
      $('settings-open').onclick = () => settings(false, $('settings-open'));
      $('pause').onclick = () => settings(true, $('pause'));
      $('settings-close').onclick = () => closeSettings();
      $('leave').onclick = () => {
        closeSettings(false);
        G.paused = false;
        G.state = 'select';
        cancel();
        if (G.free) showBook(); else showStages();
      };
      for (const id of ['sound-setting', 'volume', 'motion']) $(id).addEventListener('input', syncSettings);
      $('free-refill').onclick = fillFree;
      $('again').onclick = () => launch(G.stage);
      $('result-back').onclick = () => { G.state = 'select'; showStages(); };
      $('result-title').onclick = showTitle;
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (!$('settings').hidden) closeSettings();
        else if (G.state === 'play' && !G.choice) settings(true, $('pause'));
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && G.state === 'play' && !G.paused) settings(true, $('pause'));
      });
    }

    return {
      ready() { bind(); applySettings(); view('title', false); },
      play() {
        const info = heroes[G.cls];
        $('arena').dataset.material = G.stage.mat;
        $('stage-tag').textContent = G.free ? (practice ? practiceTitle + ' · ' : 'ASMR図鑑 · ') + L.combat.stages.MATERIALS[G.stage.mat].jp : 'STAGE 0' + G.stage.n + '  ' + G.stage.name;
        $('cls').textContent = info.name;
        $('help').textContent = helpFor(G.cls);
        $('breach').textContent = '0';
        $('clock-track').hidden = $('breach-box').hidden = $('upmeter').hidden = Boolean(G.free);
        $('boss-meter').hidden = true;
        $('combo').textContent = '';
        $('banner').classList.remove('show');
        $('free-refill').hidden = !G.free;
        $('upgrade').hidden = true;
        view('play');
      },
      result(stats) {
        const stage = G.stage;
        const first = stats.bossDefeated && !Studio.learned(stage, progress);
        if (first) { progress.cleared.push(stage.n); Studio.save(progress); }
        $('result-stage').textContent = 'STAGE 0' + stage.n + ' · ' + stage.name;
        $('r-title').textContent = stats.bossDefeated ? 'STAGE CLEAR' : 'TIME UP';
        $('result-boss').src = window.StudioBossArt['studio-boss/' + stage.mat];
        $('r-stats').replaceChildren(...[['撃破', stats.kills], ['最大連続破壊', stats.best], ['到達レベル', stats.levelUps.length + 1]].map(([label, value]) => {
          const block = document.createElement('div');
          const small = document.createElement('span');
          small.textContent = label;
          const number = document.createElement('b');
          number.textContent = value;
          block.append(small, number);
          return block;
        }));
        const materialName = L.combat.stages.MATERIALS[stage.mat].jp;
        $('r-defense').textContent = first ? materialName + 'を図鑑に解放しました。'
          : stats.bossDefeated ? stage.bossName + 'を撃破。'
          : stage.bossName + 'はまだ砕けていません。';
        $('r-growth').textContent = '侵入 ' + stats.breaches.length + ' · ' +
          (stats.ups.map(id => C.UPGRADES[stats.cls].find(upgrade => upgrade.id === id).name).join(' / ') || '強化なし');
        const next = stages[stage.n];
        const canContinue = next && stats.bossDefeated;
        $('next').textContent = canContinue ? '次のステージ ›' : first ? '図鑑で遊ぶ ›' : 'もう一度挑戦 ›';
        $('next').onclick = canContinue ? () => launch(next) : first ? () => {
          G.state = 'select';
          material = stage;
          showBook();
        } : () => launch(stage);
        view('result');
      }
    };
  };
})();
