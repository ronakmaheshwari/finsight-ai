/**
 * Standard API error used across the backend.
 *
 * Every error serializes to the same JSON shape:
 * `{ message: string, success: false, error?: string }`
 */

const API_ERROR_CODES = {
    BAD_REQUEST: "BAD_REQUEST",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
    UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
    TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
    INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

interface ApiErrorBody {
    message: string;
    success: false;
    error?: string;
}

interface ApiErrorOptions {
    message?: string;
    error?: string;
    cause?: unknown;
}

type ApiErrorInput = string | ApiErrorOptions;

interface ApiErrorDefinition {
    statusCode: number;
    message: string;
}

const API_ERROR_DEFINITIONS: Record<ApiErrorCode, ApiErrorDefinition> = {
    [API_ERROR_CODES.BAD_REQUEST]: {
        statusCode: 400,
        message: "Bad request",
    },
    [API_ERROR_CODES.VALIDATION_ERROR]: {
        statusCode: 422,
        message: "Validation failed",
    },
    [API_ERROR_CODES.UNAUTHORIZED]: {
        statusCode: 401,
        message: "You are unauthorized to access these services",
    },
    [API_ERROR_CODES.INVALID_CREDENTIALS]: {
        statusCode: 401,
        message: "Invalid credentials were provided",
    },
    [API_ERROR_CODES.TOKEN_EXPIRED]: {
        statusCode: 401,
        message: "Invalid or expired token",
    },
    [API_ERROR_CODES.FORBIDDEN]: {
        statusCode: 403,
        message: "You do not have permission to perform this action",
    },
    [API_ERROR_CODES.NOT_FOUND]: {
        statusCode: 404,
        message: "Resource not found",
    },
    [API_ERROR_CODES.CONFLICT]: {
        statusCode: 409,
        message: "Request conflicts with the current state of the resource",
    },
    [API_ERROR_CODES.EMAIL_ALREADY_EXISTS]: {
        statusCode: 409,
        message: "Email already exists in the system",
    },
    [API_ERROR_CODES.UNPROCESSABLE_ENTITY]: {
        statusCode: 422,
        message: "Request could not be processed",
    },
    [API_ERROR_CODES.TOO_MANY_REQUESTS]: {
        statusCode: 429,
        message: "Too many requests, please try again later",
    },
    [API_ERROR_CODES.INTERNAL_SERVER_ERROR]: {
        statusCode: 500,
        message: "Internal Error occured",
    },
    [API_ERROR_CODES.SERVICE_UNAVAILABLE]: {
        statusCode: 503,
        message: "Service is temporarily unavailable",
    },
};

const normalizeOptions = (input?: ApiErrorInput): ApiErrorOptions => {
    if (typeof input === "string") {
        return { message: input };
    }

    return input ?? {};
};

const resolveMessage = (message: string | undefined, fallback: string): string =>
    message === undefined || message.trim().length === 0 ? fallback : message;

const resolveError = (error: string | undefined): string | undefined =>
    error === undefined || error.trim().length === 0 ? undefined : error;

class ApiError extends Error {
    readonly success = false as const;
    readonly statusCode: number;
    readonly code: ApiErrorCode;
    readonly error?: string;

    constructor(code: ApiErrorCode = API_ERROR_CODES.INTERNAL_SERVER_ERROR, input?: ApiErrorInput) {
        const options = normalizeOptions(input);
        const definition = API_ERROR_DEFINITIONS[code];

        super(
            resolveMessage(options.message, definition.message),
            options.cause === undefined ? undefined : { cause: options.cause },
        );

        this.name = "ApiError";
        this.code = code;
        this.statusCode = definition.statusCode;
        this.error = resolveError(options.error);
    }

    toJSON(): ApiErrorBody {
        const body: ApiErrorBody = {
            message: this.message,
            success: false,
        };

        if (this.error !== undefined) {
            body.error = this.error;
        }

        return body;
    }

    static badRequest(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.BAD_REQUEST, input);
    }

    static validation(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.VALIDATION_ERROR, input);
    }

    static unauthorized(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.UNAUTHORIZED, input);
    }

    static invalidCredentials(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.INVALID_CREDENTIALS, input);
    }

    static tokenExpired(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.TOKEN_EXPIRED, input);
    }

    static forbidden(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.FORBIDDEN, input);
    }

    static notFound(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.NOT_FOUND, input);
    }

    static conflict(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.CONFLICT, input);
    }

    static emailAlreadyExists(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.EMAIL_ALREADY_EXISTS, input);
    }

    static unprocessableEntity(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.UNPROCESSABLE_ENTITY, input);
    }

    static tooManyRequests(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.TOO_MANY_REQUESTS, input);
    }

    static internal(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.INTERNAL_SERVER_ERROR, input);
    }

    static serviceUnavailable(input?: ApiErrorInput): ApiError {
        return new ApiError(API_ERROR_CODES.SERVICE_UNAVAILABLE, input);
    }

    static from(error: unknown): ApiError {
        if (error instanceof ApiError) {
            return error;
        }

        if (error instanceof Error) {
            return new ApiError(API_ERROR_CODES.INTERNAL_SERVER_ERROR, {
                cause: error,
            });
        }

        return new ApiError(API_ERROR_CODES.INTERNAL_SERVER_ERROR, {
            cause: error,
        });
    }
}

const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export { API_ERROR_CODES, ApiError, isApiError };
export type { ApiErrorBody, ApiErrorCode, ApiErrorInput, ApiErrorOptions };
