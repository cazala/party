import { Module, type ModuleDescriptor, ModuleRole } from "../../module";

type GridKeys =
  | "minX"
  | "minY"
  | "maxX"
  | "maxY"
  | "cols"
  | "rows"
  | "cellSize"
  | "maxPerCell";

export class Grid extends Module<"grid", GridKeys> {
  descriptor(): ModuleDescriptor<"grid", GridKeys> {
    return {
      name: "grid",
      role: ModuleRole.System,
      bindings: [
        "minX",
        "minY",
        "maxX",
        "maxY",
        "cols",
        "rows",
        "cellSize",
        "maxPerCell",
      ] as const,
      global: ({ getUniform }: any) => `
const NEIGHBOR_NONE: u32 = 0xffffffffu;
fn GRID_COLS() -> u32 { return u32(${getUniform("cols")}); }
fn GRID_ROWS() -> u32 { return u32(${getUniform("rows")}); }
fn GRID_MINX() -> f32 { return ${getUniform("minX")}; }
fn GRID_MINY() -> f32 { return ${getUniform("minY")}; }
fn GRID_MAXX() -> f32 { return ${getUniform("maxX")}; }
fn GRID_MAXY() -> f32 { return ${getUniform("maxY")}; }
fn GRID_CELL_SIZE() -> f32 { return ${getUniform("cellSize")}; }
fn GRID_MAX_PER_CELL() -> u32 { return u32(${getUniform("maxPerCell")}); }
fn grid_cell_index(pos: vec2<f32>) -> u32 { let col = i32(floor((pos.x - GRID_MINX()) / GRID_CELL_SIZE())); let row = i32(floor((pos.y - GRID_MINY()) / GRID_CELL_SIZE())); let c = max(0, min(col, i32(GRID_COLS()) - 1)); let r = max(0, min(row, i32(GRID_ROWS()) - 1)); return u32(r) * GRID_COLS() + u32(c); }
fn grid_cell_index_from_rc(r: i32, c: i32) -> u32 { let rr = max(0, min(r, i32(GRID_ROWS()) - 1)); let cc = max(0, min(c, i32(GRID_COLS()) - 1)); return u32(rr) * GRID_COLS() + u32(cc); }
struct NeighborIter { cx: i32, cy: i32, r: i32, c: i32, k: u32, reach: i32, maxK: u32, base: u32 }
fn neighbor_iter_init(pos: vec2<f32>, radius: f32) -> NeighborIter { let cx = i32(floor((pos.x - GRID_MINX()) / GRID_CELL_SIZE())); let cy = i32(floor((pos.y - GRID_MINY()) / GRID_CELL_SIZE())); let reach = max(1, i32(ceil(radius / GRID_CELL_SIZE()))); var it: NeighborIter; it.cx = cx; it.cy = cy; it.reach = reach; it.r = cy - reach; it.c = cx - reach; let firstCell = grid_cell_index_from_rc(it.r, it.c); let cnt = atomicLoad(&GRID_COUNTS[firstCell]); it.maxK = min(cnt, GRID_MAX_PER_CELL()); it.base = firstCell * GRID_MAX_PER_CELL(); it.k = 0u; return it; }
fn neighbor_iter_next(it: ptr<function, NeighborIter>, selfIndex: u32) -> u32 { loop { if ((*it).r > (*it).cy + (*it).reach) { return NEIGHBOR_NONE; } if ((*it).k < (*it).maxK) { let id = GRID_INDICES[(*it).base + (*it).k]; (*it).k = (*it).k + 1u; if (id != selfIndex) { return id; } else { continue; } } (*it).c = (*it).c + 1; if ((*it).c > (*it).cx + (*it).reach) { (*it).c = (*it).cx - (*it).reach; (*it).r = (*it).r + 1; } if ((*it).r > (*it).cy + (*it).reach) { return NEIGHBOR_NONE; } let cell = grid_cell_index_from_rc((*it).r, (*it).c); let cnt = atomicLoad(&GRID_COUNTS[cell]); (*it).maxK = min(cnt, GRID_MAX_PER_CELL()); (*it).base = cell * GRID_MAX_PER_CELL(); (*it).k = 0u; } }
`,
      entrypoints: () => `
@compute @workgroup_size(64)
fn grid_clear(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  let total = GRID_COLS() * GRID_ROWS();
  if (idx < total) {
    atomicStore(&GRID_COUNTS[idx], 0u);
  }
}

@compute @workgroup_size(64)
fn grid_build(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  let count = SIM_COUNT();
  if (i >= count) { return; }
  let p = particles[i];
  if (p.mass == 0.0) { return; }
  // Offscreen culling with padding (2 lines of cells)
  let minX = GRID_MINX();
  let maxX = GRID_MAXX();
  let minY = GRID_MINY();
  let maxY = GRID_MAXY();
  let pad = GRID_CELL_SIZE() * 2.0;
  if (p.position.x + p.size < minX - pad || p.position.x - p.size > maxX + pad || p.position.y + p.size < minY - pad || p.position.y - p.size > maxY + pad) {
    return;
  }
  let cell = grid_cell_index(p.position);
  let offset = atomicAdd(&GRID_COUNTS[cell], 1u);
  if (offset < GRID_MAX_PER_CELL()) {
    let base = cell * GRID_MAX_PER_CELL();
    GRID_INDICES[base + offset] = i;
  }
}
`,
    };
  }
}
