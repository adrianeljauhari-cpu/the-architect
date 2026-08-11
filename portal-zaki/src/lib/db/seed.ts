// dotenv FIRST: this is a standalone tsx entrypoint, so nothing else loads .env
// (NODE_ENV, DATABASE_URL) before src/lib/env.ts validates it. Order is load-bearing.
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { db } from "@/lib/db/index";
import {
  appUsers,
  customerOfferLines,
  customerOffers,
  customers,
  exchangeRate,
  offerLines,
  offers,
  productCaps,
  products,
} from "@/lib/db/schema";

/**
 * Realistic demo dataset from the dossier (blueprint §4 "Seed data"). Idempotent:
 * every insert skips on primary-key conflict, so a second `pnpm db:seed` adds nothing.
 * Run with `pnpm db:seed`.
 */

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const daysAhead = (d: number) => new Date(now.getTime() + d * 86_400_000);
const rowId = (n: number) => `0x${n.toString(16).padStart(16, "0")}`;

const ADMIN_ID = "00000000-0000-0000-0000-000000000001";

type ProductSeed = {
  coArt: string;
  artDes: string;
  coLin: string;
  precVta1: string;
  stockAct: string;
  stockCom: string;
};

const productSeed: ProductSeed[] = [
  [
    "A001",
    "OMEPRAZOL 20 MG X 10 CAP ( ZAKIMED )",
    "GAS",
    "2165.23",
    "500",
    "20",
  ],
  [
    "A002",
    "ACETAMINOFEN 500 MG X 10 TAB ( ZAKIMED )",
    "GEN",
    "589.84",
    "800",
    "50",
  ],
  [
    "A003",
    "AMOXICILINA 500 MG X 12 CAP ( ZAKIMED )",
    "ANT",
    "746.63",
    "300",
    "10",
  ],
  ["A004", "LOSARTAN 50 MG X 30 TAB ( ZAKIMED )", "CAR", "671.97", "250", "0"],
  [
    "A005",
    "IBUPROFENO 400 MG X 10 TAB ( ZAKIMED )",
    "GEN",
    "432.10",
    "600",
    "100",
  ],
  [
    "A006",
    "METFORMINA 850 MG X 30 TAB ( ZAKIMED )",
    "END",
    "980.55",
    "150",
    "5",
  ],
  [
    "A007",
    "ATORVASTATINA 20 MG X 30 TAB ( ZAKIMED )",
    "CAR",
    "1540.00",
    "120",
    "120",
  ],
  [
    "A008",
    "AZITROMICINA 500 MG X 3 TAB ( ZAKIMED )",
    "ANT",
    "1320.75",
    "90",
    "10",
  ],
  [
    "A009",
    "DICLOFENAC 50 MG X 20 TAB ( ZAKIMED )",
    "GEN",
    "510.40",
    "400",
    "0",
  ],
  ["A010", "RANITIDINA 150 MG X 20 TAB ( ZAKIMED )", "GAS", "388.20", "0", "0"],
  [
    "A011",
    "ENALAPRIL 10 MG X 20 TAB ( ZAKIMED )",
    "CAR",
    "455.90",
    "320",
    "20",
  ],
  [
    "A012",
    "CIPROFLOXACINA 500 MG X 10 TAB ( ZAKIMED )",
    "ANT",
    "890.00",
    "210",
    "30",
  ],
  [
    "A013",
    "OMEPRAZOL 40 MG X 14 CAP ( ZAKIMED )",
    "GAS",
    "3120.50",
    "180",
    "10",
  ],
  [
    "A014",
    "VITAMINA C 1 G X 10 TAB EFERV ( ZAKIMED )",
    "VIT",
    "275.65",
    "900",
    "0",
  ],
  ["A015", "COMPLEJO B X 30 TAB ( ZAKIMED )", "VIT", "640.30", "500", "25"],
  [
    "A016",
    "SALBUTAMOL INHALADOR 100 MCG ( ZAKIMED )",
    "RES",
    "2450.00",
    "70",
    "5",
  ],
  [
    "A017",
    "LORATADINA 10 MG X 10 TAB ( ZAKIMED )",
    "ALE",
    "360.80",
    "650",
    "0",
  ],
  [
    "A018",
    "CLONAZEPAM 2 MG X 30 TAB ( ZAKIMED )",
    "NEU",
    "1875.40",
    "60",
    "10",
  ],
  ["A019", "PREDNISONA 5 MG X 20 TAB ( ZAKIMED )", "GEN", "505.00", "300", "0"],
  [
    "A020",
    "AMLODIPINO 5 MG X 30 TAB ( ZAKIMED )",
    "CAR",
    "720.15",
    "280",
    "15",
  ],
].map(([coArt, artDes, coLin, precVta1, stockAct, stockCom]) => ({
  coArt,
  artDes,
  coLin,
  precVta1,
  stockAct,
  stockCom,
}));

export async function seed() {
  // --- products (mirror) ---
  await db
    .insert(products)
    .values(
      productSeed.map((p, i) => ({
        ...p,
        coProv: "ZAKIMED",
        uniVenta: "UND",
        anulado: false,
        rowIdHex: rowId(1000 + i),
        syncedAt: now,
      })),
    )
    .onConflictDoNothing();

  // --- customers (mirror): distinct desc_glob and distinct segments (one is 70=EXCLUIDOS) ---
  await db
    .insert(customers)
    .values([
      {
        coCli: "0370",
        cliDes: "FARMACIA LA SALUD C.A.",
        rif: "J-12345678-9",
        email: "farmacia0370@example.com",
        telefonos: "0212-5551234",
        descGlob: "12.000", // like dossier client 0370
        montCre: "5000000.00",
        saldo: "1200000.00",
        plazPag: 30,
        sincredito: false,
        coSeg: "10", // A
        tipo: "MAY",
        cond1pct: true,
        inactivo: false,
        rowIdHex: rowId(2001),
        syncedAt: now,
      },
      {
        coCli: "0002",
        cliDes: "DROGUERIA EL PUEBLO S.R.L.",
        rif: "J-98765432-1",
        email: "contado0002@example.com",
        telefonos: "0241-5556789",
        descGlob: "5.000",
        montCre: "0.00",
        saldo: "0.00",
        plazPag: 0,
        sincredito: true, // contado
        coSeg: "30", // C
        tipo: "MIN",
        cond1pct: false,
        inactivo: false,
        rowIdHex: rowId(2002),
        syncedAt: now,
      },
      {
        coCli: "0070",
        cliDes: "FARMACIA EXCLUIDA C.A.",
        rif: "J-55544433-2",
        email: null,
        telefonos: null,
        descGlob: "0.000",
        montCre: "2000000.00",
        saldo: "350000.00",
        plazPag: 15,
        sincredito: false,
        coSeg: "70", // EXCLUIDOS
        tipo: "EXC",
        cond1pct: false,
        inactivo: false,
        rowIdHex: rowId(2003),
        syncedAt: now,
      },
    ])
    .onConflictDoNothing();

  // --- offers by segment: p1 (provider, pos 0) and p3 (drugstore, pos 1) ---
  await db
    .insert(offers)
    .values([
      {
        coOfer: "OF-P1",
        oferDes: "Descuento de proveedor",
        posOfer: 0,
        fecInic: daysAgo(2),
        fecFin: daysAhead(30),
        coSegD: "10",
        coSegH: "60",
        syncedAt: now,
      },
      {
        coOfer: "OF-P3",
        oferDes: "Descuento de drogueria",
        posOfer: 1,
        fecInic: daysAgo(2),
        fecFin: daysAhead(30),
        coSegD: "10",
        coSegH: "60",
        syncedAt: now,
      },
      {
        // Segment-70-only offer: an EXCLUIDOS client takes THIS, never OF-P3.
        coOfer: "OF-EXC",
        oferDes: "Oferta EXCLUIDOS",
        posOfer: 1,
        fecInic: daysAgo(2),
        fecFin: daysAhead(30),
        coSegD: "70",
        coSegH: "70",
        syncedAt: now,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(offerLines)
    .values([
      { coOfer: "OF-P1", coArt: "A001", porcOfer: "6.000", syncedAt: now },
      { coOfer: "OF-P1", coArt: "A002", porcOfer: "6.000", syncedAt: now },
      { coOfer: "OF-P3", coArt: "A001", porcOfer: "17.000", syncedAt: now },
      { coOfer: "OF-P3", coArt: "A002", porcOfer: "34.000", syncedAt: now },
      { coOfer: "OF-P3", coArt: "A003", porcOfer: "13.000", syncedAt: now },
      { coOfer: "OF-P3", coArt: "A004", porcOfer: "4.000", syncedAt: now },
      { coOfer: "OF-EXC", coArt: "A001", porcOfer: "5.000", syncedAt: now },
    ])
    .onConflictDoNothing();

  // --- customer offer (position 2, oferta_cli) by tipo, vigente ---
  await db
    .insert(customerOffers)
    .values([
      {
        coOfer: "CO-P2",
        oferDes: "Oferta por tipo MAY",
        fecInic: daysAgo(2),
        fecFin: daysAhead(30),
        tipoD: "MAY",
        tipoH: "MAY",
        syncedAt: now,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(customerOfferLines)
    .values([
      { coOfer: "CO-P2", coCli: "0370", porcOfer: "6.000", syncedAt: now },
    ])
    .onConflictDoNothing();

  // --- product cap (porc_max) — regulated product ceiling ---
  await db
    .insert(productCaps)
    .values([{ coArt: "A018", porcMax: "15.000", syncedAt: now }])
    .onConflictDoNothing();

  // --- exchange rate (single row, id=1) ---
  const noon = new Date(now);
  noon.setHours(12, 0, 0, 0);
  await db
    .insert(exchangeRate)
    .values([{ id: 1, usdBs: "40.250000", effectiveAt: noon, syncedAt: now }])
    .onConflictDoNothing();

  // --- admin app_user (fixed id → idempotent) ---
  await db
    .insert(appUsers)
    .values([{ id: ADMIN_ID, authUserId: null, coCli: null, role: "admin" }])
    .onConflictDoNothing();

  console.log("seed: done");
}

// Run as a CLI (`pnpm db:seed`) but stay importable (integration tests self-seed).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("seed: failed", err);
      process.exit(1);
    });
}
