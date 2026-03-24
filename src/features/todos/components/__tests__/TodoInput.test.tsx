import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoInput } from "../TodoInput";

describe("TodoInput", () => {
  test("calls onAdd with trimmed text on Enter", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    render(<TodoInput onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("Add a todo...");

    await user.type(input, "  Buy groceries  {Enter}");

    expect(onAdd).toHaveBeenCalledWith("Buy groceries");
  });

  test("clears input after submission", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    render(<TodoInput onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("Add a todo...");

    await user.type(input, "Task{Enter}");

    expect(input).toHaveValue("");
  });

  test("does not call onAdd for empty input", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    render(<TodoInput onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("Add a todo...");

    await user.type(input, "   {Enter}");

    expect(onAdd).not.toHaveBeenCalled();
  });

  test("does not call onAdd for whitespace-only input", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    render(<TodoInput onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("Add a todo...");

    await user.type(input, "   {Enter}");

    expect(onAdd).not.toHaveBeenCalled();
  });
});
