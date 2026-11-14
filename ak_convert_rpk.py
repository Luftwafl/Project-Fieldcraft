# Converts the RPK Blockbench model into the game's gun literal (same node format as AK74M).
# Run with -I. Usage: convert.py <in.bbmodel> <out.js>
import json, math, sys
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))
S = 1 / 16.0                       # Blockbench pixels to blocks
G = {g['uuid']: g for g in d['groups']}
E = {e['uuid']: e for e in d['elements']}
FAM = {'Buttstock': 'wd', 'Forend': 'wd', 'Upperhandgaurd': 'wd',
       'pistolgrip': 'blk', 'magazine': 'blk', 'Trigger': 'blk', 'RearSight': 'blk', 'RearSIghtBlock': 'blk',
       'FrontsightMuzzel': 'stl'}
def mat(x, y, z):
    cx, sx = math.cos(math.radians(x)), math.sin(math.radians(x))
    cy, sy = math.cos(math.radians(y)), math.sin(math.radians(y))
    cz, sz = math.cos(math.radians(z)), math.sin(math.radians(z))
    Rx = [[1,0,0],[0,cx,-sx],[0,sx,cx]]; Ry = [[cy,0,sy],[0,1,0],[-sy,0,cy]]; Rz = [[cz,-sz,0],[sz,cz,0],[0,0,1]]
    def mm(a, b): return [[sum(a[i][k]*b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return mm(Rz, mm(Ry, Rx))                      # Rz * Ry * Rx
def apply(M, v): return [sum(M[i][k]*v[k] for k in range(3)) for i in range(3)]
def quat(x, y, z):
    M = mat(x, y, z); tr = M[0][0] + M[1][1] + M[2][2]
    if tr > 0:
        s = math.sqrt(tr + 1) * 2; w = .25*s; qx = (M[2][1]-M[1][2])/s; qy = (M[0][2]-M[2][0])/s; qz = (M[1][0]-M[0][1])/s
    elif M[0][0] > M[1][1] and M[0][0] > M[2][2]:
        s = math.sqrt(1 + M[0][0] - M[1][1] - M[2][2]) * 2; w = (M[2][1]-M[1][2])/s; qx = .25*s; qy = (M[0][1]+M[1][0])/s; qz = (M[0][2]+M[2][0])/s
    elif M[1][1] > M[2][2]:
        s = math.sqrt(1 + M[1][1] - M[0][0] - M[2][2]) * 2; w = (M[0][2]-M[2][0])/s; qx = (M[0][1]+M[1][0])/s; qy = .25*s; qz = (M[1][2]+M[2][1])/s
    else:
        s = math.sqrt(1 + M[2][2] - M[0][0] - M[1][1]) * 2; w = (M[1][0]-M[0][1])/s; qx = (M[0][2]+M[2][0])/s; qy = (M[1][2]+M[2][1])/s; qz = .25*s
    return [round(qx,6), round(qy,6), round(qz,6), round(w,6)]
# quads for a box, wound so the faces point outwards
def box_mesh(p0, p1, rot, origin):
    x0, y0, z0 = p0; x1, y1, z1 = p1
    corners = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]
    M = mat(*rot) if rot else None
    cs = []
    for c in corners:
        v = [c[i]-origin[i] for i in range(3)]
        if M: v = apply(M, v)
        cs.append([v[i]+origin[i] for i in range(3)])
    faces = [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)]
    pos, ix = [], []
    cen = [sum(c[i] for c in cs)/8 for i in range(3)]
    for f in faces:
        base = len(pos)//3
        for k in f: pos += cs[k]
        a, b, c, dd = base, base+1, base+2, base+3
        tris = [(a,b,c),(a,c,dd)]
        for t in tris:
            p = [pos[3*i:3*i+3] for i in t]
            n = [(p[1][1]-p[0][1])*(p[2][2]-p[0][2])-(p[1][2]-p[0][2])*(p[2][1]-p[0][1]),
                 (p[1][2]-p[0][2])*(p[2][0]-p[0][0])-(p[1][0]-p[0][0])*(p[2][2]-p[0][2]),
                 (p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0])]
            tc = [sum(q[i] for q in p)/3 for i in range(3)]
            if sum(n[i]*(tc[i]-cen[i]) for i in range(3)) < 0: t = (t[0], t[2], t[1])
            ix += list(t)
    return [round(v*S, 5) for v in pos], ix
nodes = []; idx_of = {}
def fam_of(name, parent_fam):
    return FAM.get(name, parent_fam or 'stl')
def add_group(n, parent, parent_origin, parent_fam):
    g = G[n['uuid']]
    name = g.get('name', '')
    fam = fam_of(name, parent_fam)
    o = [v*S for v in g['origin']]
    po = parent_origin or [0,0,0]
    t = [round(o[i]-po[i], 5) for i in range(3)] if parent is not None else [round(v, 5) for v in o]
    i = len(nodes)
    nodes.append({'n': name, 'p': -1 if parent is None else parent, 'k': fam, 't': t})
    idx_of[g['uuid']] = i
    for c in n.get('children', []):
        if isinstance(c, dict):
            add_group(c, i, o, fam)
        elif c in E:
            e = E[c]
            if e.get('type', 'cube') != 'cube': continue
            pos, ix = box_mesh([v for v in e['from']], [v for v in e['to']], e.get('rotation') and e['rotation'] or None, e.get('origin', e['from']))
            # express the mesh in the group frame (group origin subtracted, absolute units)
            pos = [round(pos[k] - o[k % 3], 5) for k in range(len(pos))]
            nodes.append({'n': e.get('name', 'cube'), 'p': i, 'k': fam_of(name, fam), 'm': pos, 'ix': ix})
top = [c for c in d['outliner'] if isinstance(c, dict)]
assert len(top) == 1 and G[top[0]['uuid']]['name'] == 'Body', 'Body must be the single root group'
add_group(top[0], None, None, None)
root_index = idx_of[top[0]['uuid']]
NAME = {n["n"]: i for i, n in enumerate(nodes) if "m" not in n}
def name_index(gname): return NAME[gname]
# animations
def channels(anim, keep):
    out = []
    for uid, an in anim['animators'].items():
        g = G.get(uid); nm = g['name'] if g else None
        if nm not in keep: continue
        rest = nodes[NAME[nm]]
        by = {}
        for k in an['keyframes']:
            by.setdefault(k['channel'], []).append(k)
        for chan, kfs in by.items():
            kfs.sort(key=lambda k: k['time'])
            times, vals = [], []
            if kfs[0]['time'] > 0:
                times.append(0.0)
                vals.append(rest.get('t', [0,0,0]) if chan == 'position' else [0,0,0,1])
            for k in kfs:
                dp = k['data_points'][0]
                x, y, z = [float(dp[c]) for c in 'xyz']
                times.append(round(k['time'], 5))
                if chan == 'position':
                    rt = rest.get('t', [0,0,0]); vals.append([round(rt[i] + x*S*(1 if i==0 else 1) if i==0 else rt[i] + (y if i==1 else z)*S, 5) for i in range(3)] if False else [round(rt[0]+x*S,5), round(rt[1]+y*S,5), round(rt[2]+z*S,5)])
                else:
                    vals.append(quat(x, y, z))
            # the translation values of the file are offsets from the rest pose; rotation is absolute
            flat = []
            for v in vals: flat += v
            out.append({'node': NAME[nm], 'path': 'translation' if chan == 'position' else 'rotation', 'times': times, 'values': flat})
    return out
anims = {a['name']: a for a in d['animations']}
new_chans = channels(anims['animation.model.new'], ['Boltcarrier', 'Trigger'])
flip_chans = channels(anims['animation.model.bipod-flip'], ['Body', 'Bipod'])
lit = {'root': root_index, 'n': nodes, 'a': new_chans, 'flip': flip_chans, 'flipDur': anims['animation.model.bipod-flip']['length']}
open(out, 'w').write('const RPKM=' + json.dumps(lit, separators=(',', ':')) + ';\n')
print('nodes', len(nodes), 'meshes', sum(1 for n in nodes if 'm' in n), 'new', len(new_chans), 'flip', len(flip_chans), 'root', root_index)
