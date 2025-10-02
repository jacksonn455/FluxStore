import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from '../controllers/products.controller';
import { ProductsService } from '../services/products.service';
import { Product, ProductSchema } from '../entities/product.entity';
import { ExchangeRatesModule } from '../../exchange-rates/modules/exchange-rates.module';
import { RabbitMQService } from '../../../common/config/rabbitmq/rabbitmq.service';
import { RedisService } from '../../../common/config/redis/redis.service';


@Module({
    imports: [
        MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
        ExchangeRatesModule,
    ],
    controllers: [ProductsController],
    providers: [
        ProductsService,
        RabbitMQService,
        RedisService
    ],
})
export class ProductsModule { }