import { describe, expect, it } from "vitest";

import { planGoal } from "../goals";

const today = new Date(2026, 9, 13);

describe("planGoal", () => {
  it("цель закрыта, когда накоплено не меньше нужного", () => {
    expect(planGoal({ targetAmount: "1000", savedAmount: "1000", deadline: null }, today)).toEqual({
      status: "achieved",
    });
  });

  it("без срока — просто сколько осталось", () => {
    expect(planGoal({ targetAmount: "1000", savedAmount: "250", deadline: null }, today)).toEqual({
      status: "open",
      remaining: 750,
    });
  });

  it("срок в будущем — сколько откладывать в месяц", () => {
    // Октябрь → июнь: 8 календарных месяцев.
    const plan = planGoal(
      { targetAmount: "120000", savedAmount: "0", deadline: "2027-06-15" },
      today,
    );

    expect(plan).toEqual({ status: "deadline", remaining: 120000, perMonth: 15000, months: 8 });
  });

  it("срок в этом месяце — всё нужно отложить сейчас", () => {
    const plan = planGoal(
      { targetAmount: "5000", savedAmount: "1000", deadline: "2026-10-30" },
      today,
    );

    expect(plan).toEqual({ status: "deadline", remaining: 4000, perMonth: 4000, months: 1 });
  });

  it("срок прошёл, а цель не закрыта", () => {
    expect(
      planGoal({ targetAmount: "5000", savedAmount: "1000", deadline: "2026-08-01" }, today),
    ).toEqual({ status: "expired", remaining: 4000 });
  });
});
