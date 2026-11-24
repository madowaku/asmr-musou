(function (L) {
  'use strict';
  const C = L.combat, study = C.rollerFeel;
  if (!study) return;
  const { clamp } = study;
  const pigments = {
    wax: { gel: [.83, .32, .52], light: [1, .78, .59], shade: [.61, .21, .39] },
    jelly: { gel: [.58, .39, .84], light: [.81, .9, 1], shade: [.38, .24, .65] },
    soap: { gel: [.25, .67, .55], light: [.81, 1, .88], shade: [.15, .48, .43] }
  };
  const tint = material => pigments[material] || pigments.wax;
  const drumColors = [[.82, .23, .53], [.86, .32, .53], [.78, .42, .17], [.40, .41, .70]];
  const quadrilateral = [0, 1, 2, 0, 2, 3];

  function pad(r, p, rx, ry, sides, color, salt) {
    const vertices = [{ x: p.x, y: p.y }], indices = [];
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2;
      const v = 1 + Math.sin(a * 5 + salt) * .09;
      vertices.push({ x: p.x + Math.cos(a) * rx * v, y: p.y + Math.sin(a) * ry * v });
      indices.push(0, i + 1, (i+1)%sides + 1);
    }
    r.mesh('roller-study/residue', vertices, indices, color, 1);
  }

  C.drawRollerResidues = (r, now) => {
    for (const mark of study.remnants) {
      const fade = Math.min(clamp((9 - (now - mark.born)) / 1.6), mark.finished === null ? 1 : clamp(1 - (now - mark.finished) / .27));
      if (fade <= 0) continue;
      const { gel, light, shade } = tint(mark.material);
      const width = mark.width * (1 - Math.min(.8, mark.worked) * .42);
      const flat = mark.material === 'jelly' ? .28 : .20;
      pad(r, { x:mark.x+2, y:mark.y+4 }, width*1.05, width*flat+4, 14, [...shade, .29*fade], 2);
      if (mark.material === 'soap') {
        for (let i=-2;i<=2;i++) {
          pad(r, { x:mark.x+i*width*.30, y:mark.y+Math.abs(i)*4 }, width*.32, width*.085+3, 4, [...gel, .70*fade], i);
        }
      } else {
        pad(r, mark, width, width*flat+4, 16, [...gel, .61*fade], 2);
        pad(r, {x:mark.x-width*.19,y:mark.y-2}, width*.51,width*.082+2, 12,[...light,.75*fade], 4);
      }
    }
  };

  function stripe(r, a, b, width, col) { r.line(a, b, width, col); }

  C.drawRollerTools = (r, hero, now) => {
    for (const body of L.world.bodies) {
      const pressure = body.rollFeel;
      if (body.removed || body.active || body.bossPart || !pressure || pressure.stage < 2) continue;
      const size = body.radius, w = size * (.39 + pressure.depth * .34), colors = tint(body.material);
      const y = body.y + size * (body.material === 'jelly' ? .20 : .24);
      r.face({x:body.x-w,y:y+2},{x:body.x+w,y:y-4},4+pressure.depth*size*.26,body.material);
      if (body.material === 'soap') {
        for(let i=0;i<Math.min(4,pressure.stage);i++){
          const row=y-18-i*7;
          stripe(r,{x:body.x-w*.69,y:row+2},{x:body.x+w*.52,y:row-3},2.7,[...colors.light,.82]);
        }
      } else {
        stripe(r,{x:body.x-w*.60,y:y+4},{x:body.x+w*.38,y:y+1},
          2.2+pressure.depth*3,[...colors.light,.82]);
      }
    }
    for (const pulse of study.ripples) {
      const age = clamp((now - pulse.born) / .32), colors = tint(pulse.material);
      const r0 = pulse.radius * (.52 + age * .48);
      if (age >= 1) continue;
      for (let j=0;j<4;j++) {
        const a = (j+.25) * Math.PI / 2, x = Math.cos(a), y = Math.sin(a)*.65;
        stripe(r,{x:pulse.x+x*r0,y:pulse.y+y*r0},{x:pulse.x+x*(r0+13),y:pulse.y+y*(r0+13)},
          pulse.quick?3.6:2.8,[...colors.shade,.75*(1-age)]);
      }
    }
    const tool = study.contact;
    if (!tool) return;
    const { ux, uy, x, y } = tool, shape = study.profile(hero);
    const width = shape.width * .96, depth = 15 + shape.level * 3.6;
    const place = (across, along) => ({ x:x+uy*across+ux*along, y:y-ux*across+uy*along });
    const bar = (margin, shift, thick, color) =>
      stripe(r,place(-width+margin,shift),place(width-margin,shift),thick,color);
    // Cast-metal cheeks and a rolling enamel drum. The highlights travel with
    // distance, so a slow pass, a brisk sweep and pressing in place read differently.
    stripe(r,place(0,-depth*.55),place(0,-40),10,[.24,.44,.39,.92]);
    stripe(r,place(0,-depth*.59),place(0,-38),4,[.68,.88,.76,.96]);
    bar(-7, -3, depth*2.38, [.22,.37,.33,.95]);
    bar(0, 0, depth*1.97, [.94,.64,.65,.97]);
    bar(1, depth*.30, depth*.95, [...drumColors[shape.level],.99]);
    const shift = ((tool.travel*.22) % (depth*.64)) - depth*.37;
    bar(3, shift, 3.6, [1,.94,.77,.98]);
    bar(5, shift + depth*.35, 2, [1,.87,.91,.87]);
    for (const side of [-1,1]) {
      stripe(r,place(side*(width+5),-depth*.68),place(side*(width+5),depth*.68),
        shape.level+5,[.52,.84,.72,1]);
    }
    // Material waves hug the contact edges and remain legible below the drum.
    if(tool.contact>0){
      const { light }=tint(tool.material||'wax');
      const lip=depth*.96;
      r.mesh('roller-study/contact',[place(-width*.80,lip),place(width*.8,lip),place(width*.65,lip+5),place(-width*.65,lip+5)],
        quadrilateral,[...light,.29+tool.contact*.46],1);
    }
  };
})(window.LAB);
