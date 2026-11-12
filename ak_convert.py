# Converts the Block Bench glTF export into a compact JS data literal for the game (run with -I).
import json, struct, base64, sys
src, out = sys.argv[1], sys.argv[2]
g = json.load(open(src))
buf = base64.b64decode(g['buffers'][0]['uri'].split(',', 1)[1])
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]; cnt = a['count']
    code = {5126: 'f', 5123: 'H', 5125: 'I'}[a['componentType']]
    return list(struct.unpack_from('<%d%s' % (n * cnt, code), buf, off))
N = g['nodes']
parent = {}
for i, n in enumerate(N):
    for c in n.get('children', []): parent[c] = i
# material family from the nearest named ancestor (Blockbench names the parts, cubes are unnamed)
FAM = {'Buttstock': 'wd', 'Forend': 'wd', 'Upperhandgaurd': 'wd',
       'pistolgrip': 'blk', 'magazine': 'blk', 'Trigger': 'blk', 'RearSight': 'blk', 'RearSIghtBlock': 'blk',
       'FrontsightMuzzel': 'stl'}
def fam(i):
    while i is not None:
        nm = N[i].get('name', '')
        if nm in FAM: return FAM[nm]
        i = parent.get(i)
    return 'stl'
nodes = []
for i, n in enumerate(N):
    e = {'n': n.get('name', ''), 'p': parent.get(i, -1), 'k': fam(i)}
    if 'translation' in n: e['t'] = [round(v, 5) for v in n['translation']]
    if 'rotation' in n: e['r'] = [round(v, 5) for v in n['rotation']]
    if 'scale' in n: e['s'] = [round(v, 5) for v in n['scale']]
    if 'mesh' in n:
        prim = g['meshes'][n['mesh']]['primitives'][0]
        p = acc(prim['attributes']['POSITION'])
        e['m'] = [round(v, 4) for v in p]
        e['ix'] = acc(prim['indices'])
    nodes.append(e)
anims = []
for a in g.get('animations', []):
    for c in a['channels']:
        s = a['samplers'][c['sampler']]
        path = c['target']['path']
        if path not in ('translation', 'rotation'): continue
        vals = acc(s['output']); k = 3 if path == 'translation' else 4
        anims.append({'node': c['target']['node'], 'path': path,
                      'times': [round(v, 4) for v in acc(s['input'])],
                      'values': [round(v, 5) for v in vals]})
data = {'root': g['scenes'][0]['nodes'][0], 'n': nodes, 'a': anims}
open(out, 'w').write('const AK74M=' + json.dumps(data, separators=(',', ':')) + ';\n')
print('nodes', len(nodes), 'anims', len(anims), 'bytes', len(open(out).read()))
