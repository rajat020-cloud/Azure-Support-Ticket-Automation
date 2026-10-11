export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PS04 — Azure Support Ticket Automation API',
    version: '1.0.0',
    description:
      'Explainable AI-assisted REST API for classifying Azure support tickets, recommending priority, assigning support teams, generating summaries and safe draft responses, and enforcing human-in-the-loop approval.',
  },
  servers: [
    {
      url: '/',
      description: 'Current API Server',
    },
  ],
  components: {
    securitySchemes: {
      ReviewerApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-reviewer-api-key',
        description:
          'Server-side reviewer secret configured via REVIEWER_API_KEY environment variable.',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Alternative Bearer token header containing REVIEWER_API_KEY.',
      },
    },
    schemas: {
      CreateTicketRequest: {
        type: 'object',
        required: ['ticketId', 'message'],
        properties: {
          ticketId: {
            type: 'string',
            example: 'TCK-1001',
            description: 'Unique alphanumeric ticket identifier (3–40 characters).',
          },
          message: {
            type: 'string',
            example: 'I cannot access my account after resetting my password.',
            description: 'Customer support message (5–5000 characters).',
          },
        },
      },
      ApproveTicketRequest: {
        type: 'object',
        required: ['approved'],
        properties: {
          approved: {
            type: 'boolean',
            example: true,
            description: 'Explicit human confirmation flag (must be true).',
          },
          reviewerId: {
            type: 'string',
            example: 'senior-reviewer@example.com',
            description: 'Identifier of the human reviewer approving the draft.',
          },
          reviewerNotes: {
            type: 'string',
            example: 'Verified account logs; draft is accurate and safe to send.',
          },
        },
      },
      Ticket: {
        type: 'object',
        properties: {
          ticketId: { type: 'string', example: 'TCK-1001' },
          message: {
            type: 'string',
            example: 'I cannot access my account after resetting my password.',
          },
          category: {
            type: 'string',
            enum: ['Billing', 'Technical', 'Access', 'General'],
            example: 'Access',
          },
          priority: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
            example: 'High',
          },
          assignedTeam: {
            type: 'string',
            enum: [
              'Billing Support',
              'Technical Support',
              'Identity and Access Support',
              'General Support',
            ],
            example: 'Identity and Access Support',
          },
          summary: { type: 'string' },
          draftResponse: { type: 'string' },
          confidence: { type: 'number', example: 0.92 },
          classificationExplanation: { type: 'string' },
          matchedSignals: { type: 'array', items: { type: 'string' } },
          prioritySignals: { type: 'array', items: { type: 'string' } },
          isUncertain: { type: 'boolean', example: false },
          reviewStatus: {
            type: 'string',
            enum: ['pending_review', 'needs_review', 'approved'],
            example: 'pending_review',
          },
          approvalMetadata: {
            type: 'object',
            properties: {
              approvedBy: { type: 'string', nullable: true },
              approvedAt: { type: 'string', format: 'date-time', nullable: true },
              reviewerNotes: { type: 'string', nullable: true },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'ValidationError' },
          message: { type: 'string', example: 'ticketId is required.' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Service and database health check',
        tags: ['System'],
        responses: {
          '200': { description: 'Service is running and MongoDB is connected' },
          '503': { description: 'Service is running but MongoDB is disconnected' },
        },
      },
    },
    '/api/tickets': {
      post: {
        summary: 'Create, classify, prioritize, and generate draft response for a support ticket',
        tags: ['Tickets'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTicketRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Ticket created and classified successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { ticket: { $ref: '#/components/schemas/Ticket' } },
                },
              },
            },
          },
          '400': {
            description: 'Validation error (missing ticketId, empty message, or malformed input)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Duplicate ticketId conflict',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '503': { description: 'Database unavailable' },
        },
      },
      get: {
        summary: 'List tickets with pagination, search, filtering, and deterministic sorting',
        tags: ['Tickets'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string', enum: ['Billing', 'Technical', 'Access', 'General'] },
          },
          {
            name: 'priority',
            in: 'query',
            schema: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
          },
          {
            name: 'reviewStatus',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['pending_review', 'needs_review', 'approved'],
            },
          },
        ],
        responses: {
          '200': { description: 'Paginated ticket list and metadata' },
          '400': { description: 'Invalid filter or pagination parameters' },
        },
      },
    },
    '/api/tickets/{ticketId}': {
      get: {
        summary: 'Retrieve a single support ticket by ticketId',
        tags: ['Tickets'],
        parameters: [
          {
            name: 'ticketId',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'TCK-1001' },
          },
        ],
        responses: {
          '200': { description: 'Ticket details' },
          '404': { description: 'Ticket not found' },
        },
      },
    },
    '/api/tickets/{ticketId}/approve': {
      post: {
        summary: 'Approve a draft response (requires reviewer authorization)',
        tags: ['Tickets'],
        security: [{ ReviewerApiKey: [] }, { BearerAuth: [] }],
        parameters: [
          {
            name: 'ticketId',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'TCK-1001' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApproveTicketRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Draft approved and persisted in MongoDB' },
          '401': { description: 'Missing reviewer authorization header' },
          '403': { description: 'Invalid reviewer authorization secret' },
          '404': { description: 'Ticket not found' },
          '409': { description: 'Ticket is already approved' },
          '422': {
            description:
              'Ticket requires mandatory manual review (needs_review) and cannot be automatically approved',
          },
        },
      },
    },
    '/api/metrics': {
      get: {
        summary: 'Retrieve live aggregate dashboard counts by category, priority, and review status',
        tags: ['Analytics'],
        responses: {
          '200': { description: 'Aggregate ticket metrics and recent tickets' },
        },
      },
    },
    '/api/evaluation': {
      get: {
        summary: 'Execute classifier and priority evaluation against held-out test dataset',
        tags: ['Analytics'],
        responses: {
          '200': { description: 'Held-out dataset accuracy, per-category metrics, and confusion matrix' },
        },
      },
    },
  },
};
