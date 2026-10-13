import { describe, expect, it } from "vitest";

import {
  isPaydayDue,
  latestPayday,
  nextPayday,
  nominalPayday,
  paydayDate,
  pendingPayday,
  toIsoDate,
} from "../schedule";

const advance = { id: "advance", dayOfMonth: 10 };
const salary = { id: "salary", dayOfMonth: 25 };
const slots = [advance, salary];

function day(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

describe("paydayDate", () => {
  it("31-е в феврале становится последним днём месяца", () => {
    expect(toIsoDate(paydayDate(2026, 1, 31))).toBe("2026-02-28");
    expect(toIsoDate(paydayDate(2028, 1, 31))).toBe("2028-02-29");
  });

  it("30-е в коротком месяце обрезается, в длинном остаётся", () => {
    expect(toIsoDate(paydayDate(2026, 3, 31))).toBe("2026-04-30");
    expect(toIsoDate(paydayDate(2026, 4, 30))).toBe("2026-05-30");
  });
});

describe("nextPayday", () => {
  it("берёт ближайшую выплату в этом месяце", () => {
    const next = nextPayday(slots, day("2026-10-13"));
    expect(next?.slot.id).toBe("salary");
    expect(toIsoDate(next!.date)).toBe("2026-10-25");
  });

  it("сегодняшняя выплата уже не «следующая»", () => {
    const next = nextPayday(slots, day("2026-10-25"));
    expect(next?.slot.id).toBe("advance");
    expect(toIsoDate(next!.date)).toBe("2026-11-10");
  });

  it("переходит через границу года", () => {
    const next = nextPayday(slots, day("2026-12-26"));
    expect(toIsoDate(next!.date)).toBe("2027-01-10");
  });

  it("учитывает обрезку 31-го в феврале", () => {
    const next = nextPayday([{ id: "end", dayOfMonth: 31 }], day("2026-02-01"));
    expect(toIsoDate(next!.date)).toBe("2026-02-28");
  });

  it("без выплат в графике — null", () => {
    expect(nextPayday([], day("2026-10-13"))).toBeNull();
  });
});

describe("latestPayday", () => {
  it("сегодняшняя выплата считается наступившей", () => {
    const latest = latestPayday(slots, day("2026-10-25"));
    expect(latest?.slot.id).toBe("salary");
  });

  it("в начале месяца берёт выплату прошлого месяца", () => {
    const latest = latestPayday(slots, day("2026-10-03"));
    expect(latest?.slot.id).toBe("salary");
    expect(toIsoDate(latest!.date)).toBe("2026-09-25");
  });
});

describe("nominalPayday", () => {
  it("зарплата, внесённая раньше срока, относится к своей плановой дате", () => {
    expect(toIsoDate(nominalPayday(salary, "2026-09-24"))).toBe("2026-09-25");
  });

  it("зарплата, внесённая с опозданием, тоже", () => {
    expect(toIsoDate(nominalPayday(advance, "2026-10-12"))).toBe("2026-10-10");
  });

  it("без выплаты в графике (её удалили) берётся фактическая дата", () => {
    expect(toIsoDate(nominalPayday(undefined, "2026-10-12"))).toBe("2026-10-12");
  });
});

describe("pendingPayday / isPaydayDue", () => {
  it("плановая выплата наступила, а внесённой нет — пора вносить", () => {
    const last = { receivedOn: "2026-09-25", payScheduleId: "salary" };
    const pending = pendingPayday(slots, last, day("2026-10-10"));

    expect(pending?.due).toBe(true);
    expect(pending?.slot.id).toBe("advance");
    expect(isPaydayDue(slots, last, day("2026-10-12"))).toBe(true);
  });

  it("выплату внесли — ждём следующую", () => {
    const last = { receivedOn: "2026-10-10", payScheduleId: "advance" };
    const pending = pendingPayday(slots, last, day("2026-10-13"));

    expect(pending?.due).toBe(false);
    expect(pending?.slot.id).toBe("salary");
    expect(toIsoDate(pending!.date)).toBe("2026-10-25");
  });

  it("зарплату внесли за день до срока — на сам день срока не просим повторно", () => {
    const last = { receivedOn: "2026-10-24", payScheduleId: "salary" };

    expect(isPaydayDue(slots, last, day("2026-10-25"))).toBe(false);
  });

  it("выплату внесли с опозданием — повторно не просим", () => {
    const last = { receivedOn: "2026-10-12", payScheduleId: "advance" };

    expect(isPaydayDue(slots, last, day("2026-10-15"))).toBe(false);
  });

  it("выплат ещё не было вообще — пора вносить", () => {
    expect(isPaydayDue(slots, null, day("2026-10-13"))).toBe(true);
  });

  it("график пустой — вносить нечего", () => {
    expect(pendingPayday([], null, day("2026-10-13"))).toBeNull();
  });
});
