export class ProductDTO {
    name: string;
    price: number;
    expiration: Date;
    exchangeRates: Record<string, number>;
}