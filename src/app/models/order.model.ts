export interface CreateOrderItemRequest {
  productId: number;
  quantity: number;
}

export interface CreateOrderRequest {
  customerEmail?: string;
  items: CreateOrderItemRequest[];
}

export interface OrderItemResponse {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderResponse {
  id: number;
  status: string;
  createdAt: string;
  totalAmount: number;
  userId: number;
  customerEmail: string;
  items: OrderItemResponse[];
}