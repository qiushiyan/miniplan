import { undo, getCurrentSchedule } from "@/lib/schedule";
import { NextResponse } from "next/server";

export async function POST() {
  const restored = undo();
  if (!restored) {
    return NextResponse.json(
      { success: false, message: "Nothing to undo" },
      { status: 400 }
    );
  }
  return NextResponse.json({
    success: true,
    schedule: getCurrentSchedule(),
  });
}
