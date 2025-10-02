import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Product extends Document {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true, type: Number })
    price: number;

    @Prop({ required: true, type: Date })
    expiration: Date;

    @Prop({ type: Object, default: {} })
    exchangeRates: Record<string, number>;
}

export const ProductSchema = SchemaFactory.createForClass(Product);