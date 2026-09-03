import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BLIND_ZONES,
  validateZone,
  resolveZones,
  parseZoneFlags,
  type ZoneLayer,
} from "../src/core/zones.js";

const SAMPLES: Record<string, string> = {
  orm: "  const u = await prisma.user.findUnique({ where: { email } })",
  "cjs-handler": "exports.createUser = async (req, res) => {",
  queue: "  await boss.send('email', payload)",
  middleware: "app.use(cors())",
  "next-entry": "export async function getServerSideProps(ctx) {",
};

test("every DEFAULT zone is a valid regex and matches its representative line", () => {
  for (const z of DEFAULT_BLIND_ZONES) {
    assert.match(SAMPLES[z.label], new RegExp(z.re), `${z.label} should match its sample`);
  }
});

test("next-entry matches getServerSideProps (not the buggy get(Server|Static)Props shorthand)", () => {
  const re = new RegExp(DEFAULT_BLIND_ZONES.find((z) => z.label === "next-entry")!.re);
  assert.match("export async function getServerSideProps() {}", re);
  assert.match("export const getStaticPaths = async () => {}", re);
});

test("validateZone: accepts valid, rejects missing label / missing re / bad regex", () => {
  assert.ok(validateZone({ label: "x", re: "a\\.b\\(" }).zone);
  assert.ok(validateZone({ label: "", re: "x" }).error);
  assert.ok(validateZone({ label: "x" }).error);
  assert.ok(validateZone({ label: "x", re: "a(b" }).error); // unbalanced paren
  assert.equal(validateZone("nope").error !== undefined, true);
});

test("validateZone: enabled:false is valid without a regex (it disables an inherited zone)", () => {
  const { zone, error } = validateZone({ label: "next-entry", enabled: false });
  assert.equal(error, undefined);
  assert.equal(zone!.enabled, false);
});

test("resolveZones: defaults only → all defaults with source=default", () => {
  const { zones, warnings } = resolveZones([{ source: "default", zones: DEFAULT_BLIND_ZONES }]);
  assert.equal(zones.length, DEFAULT_BLIND_ZONES.length);
  assert.equal(warnings.length, 0);
  assert.ok(zones.every((z) => z.source === "default"));
});

test("resolveZones: same label in a higher layer overrides (re + source)", () => {
  const layers: ZoneLayer[] = [
    { source: "default", zones: DEFAULT_BLIND_ZONES },
    { source: "repo", zones: [{ label: "orm", re: "db\\.(select|insert)\\(", note: "drizzle" }] },
  ];
  const { zones } = resolveZones(layers);
  const orm = zones.find((z) => z.label === "orm")!;
  assert.equal(orm.re, "db\\.(select|insert)\\(");
  assert.equal(orm.source, "repo");
});

test("resolveZones: new label is added; enabled:false removes an inherited one", () => {
  const layers: ZoneLayer[] = [
    { source: "default", zones: DEFAULT_BLIND_ZONES },
    { source: "repo", zones: [{ label: "graphql", re: "resolvers\\.", note: "gql" }, { label: "next-entry", enabled: false }] },
  ];
  const { zones } = resolveZones(layers);
  assert.ok(zones.find((z) => z.label === "graphql"));
  assert.equal(zones.find((z) => z.label === "next-entry"), undefined);
});

test("resolveZones: invalid entry → warning, skipped, others survive", () => {
  const { zones, warnings } = resolveZones([
    { source: "user", zones: [{ label: "bad", re: "a(b" }, { label: "good", re: "x\\(" }] },
  ]);
  assert.equal(zones.length, 1);
  assert.equal(zones[0].label, "good");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /\[user\].*bad/);
});

test("parseZoneFlags: --zone label=regex (both forms), malformed skipped", () => {
  const z = parseZoneFlags(["--zone", "orm=db\\.x\\(", "--zone=q=\\.add\\(", "--zone", "nope-no-eq"]);
  assert.equal(z.length, 2);
  assert.deepEqual(z.map((x) => x.label).sort(), ["orm", "q"]);
});
