"""Derive a closed-to-open hood animation without changing the supplied source."""
import argparse
import json
import math
import struct
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--output', default='public/models/land-cruiser-300-animated.glb')
args = parser.parse_args()
raw = Path(args.source).read_bytes()
magic, version, length = struct.unpack_from('<4sII', raw)
assert magic == b'glTF' and version == 2 and length == len(raw)
json_length, _ = struct.unpack_from('<I4s', raw, 12)
document = json.loads(raw[20:20 + json_length])
bin_start = 20 + json_length
bin_length, bin_type = struct.unpack_from('<I4s', raw, bin_start)
assert bin_type == b'BIN\x00'
binary = bytearray(raw[bin_start + 8:bin_start + 8 + bin_length])
hood_nodes = [i for i, node in enumerate(document['nodes']) if node.get('name', '').startswith('Hood_Open_')]
assert len(hood_nodes) == 4, 'Expected the four supplied hood meshes'
matrix = document['nodes'][hood_nodes[0]]['matrix']
angle = math.radians(80)
a, b = 1 - math.cos(angle), math.sin(angle)
pivot_y = (a * matrix[13] + b * matrix[14]) / (a*a + b*b)
pivot_z = (-b * matrix[13] + a * matrix[14]) / (a*a + b*b)

def accessor(values, kind, count, minimum=None, maximum=None):
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    binary.extend(struct.pack('<' + 'f' * len(values), *values))
    view = len(document.setdefault('bufferViews', []))
    document['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(values) * 4})
    index = len(document.setdefault('accessors', []))
    item = {'bufferView': view, 'componentType': 5126, 'count': count, 'type': kind}
    if minimum is not None:
        item.update(min=minimum, max=maximum)
    document['accessors'].append(item)
    return index

frames = 49
duration = 2.4
times = [duration * i / (frames - 1) for i in range(frames)]
rotations, translations = [], []
for i in range(frames):
    t = i / (frames - 1)
    theta = angle * (t*t*(3 - 2*t))
    rotations.extend([-math.sin(theta/2), 0, 0, math.cos(theta/2)])
    translations.extend([0, (1-math.cos(theta))*pivot_y-math.sin(theta)*pivot_z,
                         math.sin(theta)*pivot_y+(1-math.cos(theta))*pivot_z])
time_accessor = accessor(times, 'SCALAR', frames, [0], [duration])
rotation_accessor = accessor(rotations, 'VEC4', frames)
translation_accessor = accessor(translations, 'VEC3', frames)
animation = {'name': 'HoodOpen', 'samplers': [
    {'input': time_accessor, 'output': rotation_accessor, 'interpolation': 'LINEAR'},
    {'input': time_accessor, 'output': translation_accessor, 'interpolation': 'LINEAR'},
], 'channels': []}
for index in hood_nodes:
    node = document['nodes'][index]
    original = node.pop('matrix')
    node.update(translation=[0, 0, 0], rotation=[0, 0, 0, 1], scale=[
        math.sqrt(sum(original[col*4+row]**2 for row in range(3))) for col in range(3)
    ])
    for sampler, path in [(0, 'rotation'), (1, 'translation')]:
        animation['channels'].append({'sampler': sampler, 'target': {'node': index, 'path': path}})
document['animations'] = [animation]
document['buffers'][0]['byteLength'] = len(binary)
document['asset'].setdefault('extras', {})['animationNote'] = 'Derived HoodOpen animation: original 80-degree open pose at 2.4 seconds; closed at 0. Training composite, not verified component geometry.'
encoded = json.dumps(document, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
binary += b'\x00' * (-len(binary) % 4)
result = struct.pack('<4sII', b'glTF', 2, 12+8+len(encoded)+8+len(binary))
result += struct.pack('<I4s', len(encoded), b'JSON') + encoded
result += struct.pack('<I4s', len(binary), b'BIN\x00') + binary
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(result)
print(f'Wrote {output}: {len(hood_nodes)} hood nodes, {duration}s animation, {len(result):,} bytes')
