import { requireUser } from "@/lib/auth";
import { getMyDay } from "@/lib/dashboard/queries";
import { MyDayPanel } from "../my-day-panel";

export async function MyDayWidget() {
  const user = await requireUser();
  const data = await getMyDay(user.id);
  return <MyDayPanel {...data} />;
}
