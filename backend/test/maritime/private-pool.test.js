import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { matchVerifiedFormerWorkers, parsePrivatePoolFile, validatePoolRows } from "../../src/lib/maritime-private-pool.js";

test("CSV import maps headers, keeps rows separate and rejects invalid rank", async () => {
  const rows = await parsePrivatePoolFile(Buffer.from("ad_soyad,rutbe,email\nAli Deniz,master,ali@example.com\nAyşe Deniz,unknown,ayse@example.com\n"), "pool.csv");
  const checked = validatePoolRows(rows, ["master"]);
  assert.equal(checked.accepted.length, 1);
  assert.equal(checked.rejected[0].row, 3);
  assert.equal(checked.accepted[0].full_name, "Ali Deniz");
});

test("Excel import accepts a single worksheet and rejects formula cells", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Candidates");
  sheet.addRow(["ad_soyad", "rutbe"]);
  sheet.addRow(["Aday Bir", "oiler"]);
  const buffer = await book.xlsx.writeBuffer();
  assert.equal((await parsePrivatePoolFile(Buffer.from(buffer), "pool.xlsx"))[0].rank_code, "oiler");
  sheet.getCell("A2").value = { formula: 'HYPERLINK("https://bad.example")' };
  const unsafe = await book.xlsx.writeBuffer();
  await assert.rejects(() => parsePrivatePoolFile(Buffer.from(unsafe), "pool.xlsx"), /Formül/);
});

test("CSV parser handles quoted commas but rejects oversized files", async () => {
  const rows = await parsePrivatePoolFile(Buffer.from('ad_soyad,rutbe\n"Deniz, Ali",master\n'), "pool.csv");
  assert.equal(rows[0].full_name, "Deniz, Ali");
  await assert.rejects(() => parsePrivatePoolFile(Buffer.alloc(1024 * 1024 + 1), "pool.csv"), /1 MB/);
});

test("former-worker badge needs verified relationship plus exact name and email", () => {
  const candidates = [{ full_name: "Ayşe Deniz", email: "ayse@example.com" }, { full_name: "Ayşe Deniz", email: "wrong@example.com" }];
  const profiles = [{ id: "user-1", full_name: "AYŞE DENİZ", email: "ayse@example.com", profile_visible: true }];
  const verified = [{ seafarer_user_id: "user-1", verification_status: "reviewer_verified" }];
  assert.deepEqual(matchVerifiedFormerWorkers(candidates, verified, profiles).map((item) => item.previous_verified_worker), [true, false]);
  assert.equal(matchVerifiedFormerWorkers(candidates, [{ ...verified[0], verification_status: "claimed" }], profiles)[0].previous_verified_worker, false);
  assert.equal(matchVerifiedFormerWorkers(candidates, verified, [{ ...profiles[0], profile_visible: false }])[0].previous_verified_worker, false);
});
