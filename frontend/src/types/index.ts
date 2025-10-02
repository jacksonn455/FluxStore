export interface Product {
  _id: string;
  name: string;
  price: number;
  expiration: string;
  currencyConversions: Record<string, number>;
  exchangeRates?: {
    date: string;
    rates: Record<string, number>;
  };
  createdAt: string;
  updatedAt: string;
}