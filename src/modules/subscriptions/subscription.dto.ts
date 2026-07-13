export interface CreateSubscriptionInput {
  email: string;
  repo: string;
}

export interface SubscriptionResponse {
  id: string;
  email: string;
  repo: string;
  isActive: boolean;
  confirmedAt: string | null;
  createdAt: string;
}
