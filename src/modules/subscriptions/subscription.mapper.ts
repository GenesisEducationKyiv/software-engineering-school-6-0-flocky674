import { SubscriptionResponse } from './subscription.dto';
import { SubscriptionWithRepo } from './subscription.ports';

/**
 * Translates persistence entities into API DTOs. Keeping this out of the
 * service isolates the reason to change "presentation shape" from the reason
 * to change "business rules" (SRP).
 */
export function toSubscriptionResponse(sub: SubscriptionWithRepo): SubscriptionResponse {
  return {
    id: sub.id,
    email: sub.email,
    repo: sub.repository.fullName,
    isActive: sub.isActive,
    confirmedAt: sub.confirmedAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
  };
}
