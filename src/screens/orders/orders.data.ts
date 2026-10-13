import type { OrderStatusKey } from '../../services';

export const STATUS_STYLES: Record<
  OrderStatusKey,
  { bg: string; icon: string; text: string }
> = {
  Delivered: { bg: '#E4F9F1', icon: 'check-circle-outline', text: '#1E9E6B' },
  Processing: { bg: '#EAF3FF', icon: 'progress-clock', text: '#2F6FE0' },
  'Out for delivery': {
    bg: '#FFF3E0',
    icon: 'truck-fast-outline',
    text: '#C77A11',
  },
  Cancelled: { bg: '#FDECEC', icon: 'close-circle-outline', text: '#D64545' },
};

// Submitted Requests for Quotation, listed alongside orders.
export const QUOTATION_STYLE = {
  bg: '#F1ECFF',
  icon: 'file-document-outline',
  text: '#6B4FD8',
};
