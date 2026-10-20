// What a waiting (offline) save does when the connection comes back.
import type { Api } from '../api/data';
type P = Record<string, unknown>;
export async function sendPending(api: Api, p: P): Promise<void> {
  switch (p.__op) {
    case 'submitLesson': await api.submitLesson(p.args as Parameters<Api['submitLesson']>[0]); return;
    case 'saveRecall': await api.saveRecall(p.args as Parameters<Api['saveRecall']>[0]); return;
    case 'partnerConfirm': await api.partnerConfirm(p.sessionId as string, p.args as Parameters<Api['partnerConfirm']>[1]); return;
    default: {
      const { __partner, __op, ...rec } = p; void __op;
      const sid = await api.recordSession(rec as Parameters<Api['recordSession']>[0]);
      if (__partner && sid) await api.requestPartner(sid as string, __partner as string);
    }
  }
}
