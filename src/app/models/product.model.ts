export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryName: string;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  categoryId: number;
}
