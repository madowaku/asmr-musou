/* Deterministic gestures and contacts for the listening desk and offline checks. */
(function (root) {
  'use strict';
  const materials = {
    wax: 'ロウ', jelly: 'ゼリー', soap: '石鹸', chalk: 'チョーク', sand: 'キネティックサンド',
    sponge: '吸水スポンジ', beadslime: '粒入りスライム', kohaku: '琥珀糖'
  };
  const heroes = { slasher: '大剣士', crusher: '拳闘士', caster: '魔法使い', spinner: '双剣士', roller: '圧延士' };
  const scenes = {
    single: '単音・素材が壊れる瞬間', opening: '序盤・ひとつずつ', repeat: '連続攻撃',
    crowd: '大群・連鎖と余韻', boss: 'ボス・外殻からコア', film: '撮影・静寂と圧縮',
    ambience: 'ステージ環境音', ui: 'UI・選択と成長'
  };
  function plan(scene, material, hero) {
    const actions = [];
    const add = (ms, name, data, fx = false) => actions.push({ ms, name, data: { material, ...data }, fx });
    const hit = (ms, x, kind = 'cut') => add(ms, kind, { x, speed: 1150, length: 170, depth: .7, area: 3600 });
    const attack = (ms, x, combo = 1) => {
      if (hero === 'slasher') {
        add(ms, 'iai_draw', { x, still: .115 }, true);
        add(ms + 140, 'iai_open', { x }, true);
        hit(ms + 140, x);
        add(ms + 205, 'iai_slide', { x }, true);
      } else {
        const kind = { crusher: 'punch', caster: 'gravity_burst', spinner: 'twin', roller: 'roller_contact' }[hero];
        add(ms, kind, { x, combo }, true);
        hit(ms + 24, x);
      }
    };
    const press = (at, duration) => {
      add(at, 'roller_contact', { x: 355 }, true);
      for (let ms = 0; ms < duration; ms += 45) {
        add(at + ms, 'strain', { x: 330 + ms / 12, amount: .25 + .43 * ms / duration, rate: .64 });
      }
      add(at + duration, 'strain', { x: 410, amount: 0 });
      hit(at + duration + 30, 410, 'peel');
    };
    if (scene === 'single') hit(220, 360);
    if (scene === 'opening') { attack(240, 235); attack(1100, 480, 2); }
    if (scene === 'repeat') {
      if (hero === 'roller') press(250, 1310);
      else for (let i = 0; i < 7; i++) attack(200 + i * (hero === 'slasher' ? 350 : 135), 180 + 58 * i, i + 1);
    }
    if (scene === 'crowd') {
      attack(170, 230, 3);
      const kills = Array.from({ length: 33 }, (_, i) => ({ material, x: 90 + i * 16, dt: i * 9 }));
      add(415, 'wave', { kills, dir: { x: 1 } });
    }
    if (scene === 'boss') {
      for (const [ms, layer] of [[230,0],[1070,1]]) {
        add(ms, 'boss_layer', { layer, x: 360 }, true);
        [...Array(6)].forEach((_, i) => hit(ms + i * 19, 140 + i * 85, 'kill'));
      }
      add(1870, 'boss_crack', { stage: 1, x: 300 }, true);
      add(2380, 'boss_crack', { stage: 2, x: 415 }, true);
      add(2910, 'finale', { x: 360 }, true);
    }
    if (scene === 'film') { attack(280, 225, 2); press(1260, 1140); }
    if (scene === 'ui') {
      add(180, 'ui_select', {}, true);
      add(780, 'levelup_ready', {}, true);
      add(1400, 'levelup', {}, true);
      add(2400, 'ui_unlock', {}, true);
    }
    const duration = { single: 900, opening: 1950, repeat: 2900, crowd: 3000,
      boss: 5100, film: 3250, ambience: 5600, ui: 3200 }[scene];
    return { actions: actions.sort((a,b) => a.ms - b.ms), duration, bed: scene === 'ambience' ? material : null };
  }
  const api = { materials, heroes, scenes, plan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudioSoundScenes = api;
})(typeof window === 'undefined' ? globalThis : window);
