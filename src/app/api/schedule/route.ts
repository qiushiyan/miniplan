import { getCurrentSchedule } from "@/lib/schedule";
import { NextResponse } from "next/server";

export async function GET() {
  const schedule = getCurrentSchedule();
  return NextResponse.json(schedule);
}
