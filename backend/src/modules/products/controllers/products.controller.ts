import {
  Controller,
  Get,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  UseGuards,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from '../services/products.service';
import {
  CsvUploadThrottle,
  ApiQueryThrottle,
} from '../decorator/custom-throttler.decorator';
import { IpBasedThrottlerGuard } from '../guard/ip-based-throttler.guard';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('upload')
  @ApiOperation({ 
    summary: 'Upload CSV file',
    description: 'Endpoint for uploading and processing product CSV files. Rate limit: 2 requests per minute per IP.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file containing product data',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200,
    description: 'File processed successfully',
    schema: {
      example: {
        message: 'File processed successfully',
        result: { processed: 150, errors: 0 },
        rateLimitInfo: {
          endpoint: 'csv-upload',
          limit: 2,
          windowMs: 60000,
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400,
    description: 'File processing error',
    schema: {
      example: {
        message: 'Error processing file: Invalid CSV format',
        error: 'Bad Request',
        statusCode: 400
      }
    }
  })
  @ApiResponse({ 
    status: 429,
    description: 'Too many requests - Rate limit exceeded'
  })
  @CsvUploadThrottle()
  @UseGuards(IpBasedThrottlerGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: Request, @Res() res: Response) {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      const result = await this.productsService.processCSVFromUpload(file);

      res.setHeader('X-RateLimit-Limit', '2');
      res.setHeader('X-RateLimit-Remaining', '1');
      res.setHeader('X-RateLimit-Reset', Date.now() + 60000);

      return res.json({
        message: 'File processed successfully',
        result,
        rateLimitInfo: {
          endpoint: 'csv-upload',
          limit: 2,
          windowMs: 60000,
        },
      });
    } catch (error) {
      console.error('CSV Upload Error:', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });

      throw new BadRequestException(`Error processing file: ${error.message}`);
    }
  }

  @Get()
  @ApiOperation({ 
    summary: 'List products',
    description: 'Endpoint to list products with filtering, sorting and pagination. Rate limit: 100 requests per minute per IP.'
  })
  @ApiQuery({ name: 'name', required: false, description: 'Filter by product name' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price in USD', type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price in USD', type: Number })
  @ApiQuery({ 
    name: 'sortBy', 
    required: false, 
    description: 'Field to sort by (e.g., name, price)',
    enum: ['name', 'price', 'createdAt']
  })
  @ApiQuery({ 
    name: 'sortOrder', 
    required: false, 
    description: 'Sort direction',
    enum: ['asc', 'desc']
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number,
    description: 'Page number (default: 1)',
    example: 1
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    description: 'Items per page (max: 100, default: 10)',
    example: 10
  })
  @ApiResponse({ 
    status: 200,
    description: 'Products list retrieved successfully',
    schema: {
      example: {
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            name: 'Product Name',
            price: 99.99,
            currencyConversions: {
              EUR: 89.99,
              BRL: 499.95
            },
            exchangeRates: {
              base: 'USD',
              rates: { EUR: 0.9, BRL: 5.0 }
            }
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 150,
          totalPages: 15
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400,
    description: 'Invalid query parameters'
  })
  @ApiResponse({ 
    status: 429,
    description: 'Too many requests - Rate limit exceeded'
  })
  @ApiQueryThrottle()
  async getProducts(
    @Query('name') name?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(limit, 100));

    const filters: any = {};
    if (name) filters.name = { $regex: name, $options: 'i' };
    if (minPrice !== undefined) filters.minPrice = minPrice;
    if (maxPrice !== undefined) filters.maxPrice = maxPrice;

    const sort: any = {};
    if (sortBy) {
      sort.field = sortBy;
      sort.order = sortOrder || 'asc';
    }

    const result = await this.productsService.findAll(
      filters,
      sort,
      safePage,
      safeLimit,
    );

    const productsWithConversions = result.products.map((product) => {
      const productObj = product.toObject ? product.toObject() : product;
      const { exchangeRates, ...rest } = productObj;

      return {
        ...rest,
        currencyConversions: this.calculateCurrencyConversions(
          productObj.price,
          exchangeRates?.rates || {},
        ),
        exchangeRates,
      };
    });

    return {
      data: productsWithConversions,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: result.total,
        totalPages: Math.ceil(result.total / safeLimit),
      },
    };
  }

  @Get('count')
  @ApiOperation({ summary: 'Count products', description: 'Returns the total number of products in the system' })
  @ApiResponse({ 
    status: 200,
    description: 'Count retrieved successfully',
    schema: {
      example: {
        total: 150
      }
    }
  })
  @SkipThrottle()
  async getCount() {
    const count = await this.productsService.count();
    return { total: count };
  }

  private calculateCurrencyConversions(
    priceUSD: number,
    rates: Record<string, number>,
  ) {
    const conversions: Record<string, number> = {};

    for (const [currency, rate] of Object.entries(rates)) {
      conversions[currency] = parseFloat((priceUSD * rate).toFixed(2));
    }

    return conversions;
  }
}