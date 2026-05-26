import { getAvisos } from "@/lib/dashboard/queries";
import { AvisosPanel } from "../avisos-panel";

export async function AvisosWidget() {
  const data = await getAvisos();
  return <AvisosPanel {...data} />;
}
