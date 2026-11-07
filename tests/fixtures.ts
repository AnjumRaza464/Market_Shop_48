export function formatDataToObjectFixture(): FormData {
  const fd = new FormData();
  fd.set("partyId", "3");
  fd.set("billDate", "2026-11-08");
  fd.set("gariNumber", "");
  fd.set("commissionPct", "6");
  fd.set("freight", "");
  fd.set("labour", "350");
  fd.set("marketFee", "");
  fd.set("munshiyana", "");
  fd.set("otherExpense", "");
  fd.set("otherExpenseNote", "");
  fd.set("advanceAdjusted", "");
  fd.set("notes", "");
  fd.set("items[0][itemName]", "Tomato");
  fd.set("items[0][quantity]", "250");
  fd.set("items[0][unit]", "kg");
  fd.set("items[0][rate]", "48.5");
  fd.set("items[1][itemName]", "Onion");
  fd.set("items[1][quantity]", "100");
  fd.set("items[1][unit]", "bag");
  fd.set("items[1][rate]", "900");
  fd.set("$ACTION_ID_abc", "ignored");
  return fd;
}
