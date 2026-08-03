import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

export function setupSwagger(app: INestApplication, globalPrefix: string, port: string) {
    if (process.env.SWAGGER !== 'true') return;

    const config = new DocumentBuilder().setTitle('API').setDescription('API description').setVersion('1.0').addBearerAuth().build();

    const docsPath = `${globalPrefix}/docs`;
    const jsonPath = `${globalPrefix}/swagger.json`;

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(docsPath, app, document, { jsonDocumentUrl: jsonPath, swaggerOptions: { persistAuthorization: true } });

    const logger = app.get(Logger);
    logger.log(`📚 Swagger UI: http://localhost:${port}/${docsPath}`);
    logger.log(`📄 OpenAPI JSON: http://localhost:${port}/${jsonPath}`);
}
