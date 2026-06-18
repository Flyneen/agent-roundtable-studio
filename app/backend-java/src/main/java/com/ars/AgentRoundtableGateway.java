package com.ars;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AgentRoundtableGateway {
    private static final Config CONFIG = Config.fromEnv();
    private static final Map<String, String> CONTENT_TYPES = contentTypes();

    private AgentRoundtableGateway() {
    }

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(CONFIG.host, CONFIG.port), 0);
        server.createContext("/", new GatewayHandler());
        server.setExecutor(Executors.newFixedThreadPool(CONFIG.threads));
        server.start();
        System.out.printf(
            "ARS Java API Gateway listening on http://%s:%d basePath=%s orchestrator=%s%n",
            CONFIG.host,
            CONFIG.port,
            CONFIG.appBasePath,
            CONFIG.orchestratorUrl
        );
    }

    private static final class GatewayHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                addCommonHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            String path = stripBasePath(exchange.getRequestURI().getPath());
            try {
                if ("/health".equals(path)) {
                    sendJson(exchange, 200, healthJson());
                    return;
                }
                if (path.equals("/api") || path.startsWith("/api/")) {
                    proxyToOrchestrator(exchange, path);
                    return;
                }
                if ("GET".equalsIgnoreCase(exchange.getRequestMethod()) || "HEAD".equalsIgnoreCase(exchange.getRequestMethod())) {
                    serveStatic(exchange, path);
                    return;
                }
                sendText(exchange, 404, "Not found");
            } catch (Exception error) {
                String message = escapeJson(error.getMessage() == null ? "Internal error" : error.getMessage());
                sendJson(exchange, 500, "{\"error\":\"internal_error\",\"message\":\"" + message + "\"}");
            }
        }
    }

    private static String healthJson() {
        String upstreamStatus = "\"unknown\"";
        String orchestratorRuntime = "unknown";
        String openaiConfigured = "false";
        try {
            HttpResponse response = request("GET", "/health", null);
            upstreamStatus = response.body == null || response.body.isBlank() ? "\"empty\"" : response.body;
            orchestratorRuntime = extractJsonString(response.body, "runtime", "unknown");
            openaiConfigured = extractJsonBoolean(response.body, "openaiConfigured", "false");
        } catch (Exception error) {
            upstreamStatus = "{\"ok\":false,\"error\":\"" + escapeJson(error.getMessage()) + "\"}";
        }
        return "{"
            + "\"ok\":true,"
            + "\"service\":\"ars-java-api-gateway\","
            + "\"architecture\":\"java-api-gateway-python-ai-orchestrator\","
            + "\"runtime\":\"" + escapeJson(orchestratorRuntime) + "\","
            + "\"openaiConfigured\":" + openaiConfigured + ","
            + "\"timestamp\":\"" + Instant.now() + "\","
            + "\"orchestrator\":" + upstreamStatus
            + "}";
    }

    private static void proxyToOrchestrator(HttpExchange exchange, String path) throws IOException {
        String method = exchange.getRequestMethod();
        String query = exchange.getRequestURI().getRawQuery();
        String fullPath = path + (query == null || query.isBlank() ? "" : "?" + query);
        byte[] requestBody = readAll(exchange.getRequestBody());
        HttpResponse response = request(method, fullPath, requestBody);
        Headers headers = exchange.getResponseHeaders();
        addCommonHeaders(exchange);
        headers.set("Content-Type", response.contentType == null ? "application/json; charset=utf-8" : response.contentType);
        if (response.contentDisposition != null) {
            headers.set("Content-Disposition", response.contentDisposition);
        }
        byte[] body = response.body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(response.status, body.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(body);
        }
    }

    private static HttpResponse request(String method, String path, byte[] body) throws IOException {
        URL url = URI.create(CONFIG.orchestratorUrl + path).toURL();
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(CONFIG.orchestratorTimeoutMs);
        connection.setReadTimeout(CONFIG.orchestratorTimeoutMs);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        if (body != null && body.length > 0 && allowsBody(method)) {
            connection.setDoOutput(true);
            try (OutputStream os = connection.getOutputStream()) {
                os.write(body);
            }
        }

        int status = connection.getResponseCode();
        InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String text = new String(readAll(input), StandardCharsets.UTF_8);
        return new HttpResponse(
            status,
            text,
            connection.getHeaderField("Content-Type"),
            connection.getHeaderField("Content-Disposition")
        );
    }

    private static boolean allowsBody(String method) {
        return "POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method);
    }

    private static void serveStatic(HttpExchange exchange, String path) throws IOException {
        String safePath = path == null || path.isBlank() || "/".equals(path) ? "/index.html" : path;
        if (!safePath.contains(".") || safePath.endsWith("/")) {
            safePath = "/index.html";
        }
        Path resolved = CONFIG.staticRoot.resolve(safePath.substring(1)).normalize();
        if (!resolved.startsWith(CONFIG.staticRoot)) {
            sendText(exchange, 403, "Forbidden");
            return;
        }
        if (!Files.exists(resolved) || Files.isDirectory(resolved)) {
            sendText(exchange, 404, "Not found");
            return;
        }

        Headers headers = exchange.getResponseHeaders();
        addCommonHeaders(exchange);
        headers.set("Content-Type", CONTENT_TYPES.getOrDefault(extension(resolved), "application/octet-stream"));
        if ("HEAD".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(200, -1);
            return;
        }
        byte[] data = Files.readAllBytes(resolved);
        exchange.sendResponseHeaders(200, data.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(data);
        }
    }

    private static String stripBasePath(String path) {
        if (CONFIG.appBasePath.isEmpty()) {
            return path == null || path.isBlank() ? "/" : path;
        }
        if (path.equals(CONFIG.appBasePath)) {
            return "/";
        }
        if (path.startsWith(CONFIG.appBasePath + "/")) {
            String stripped = path.substring(CONFIG.appBasePath.length());
            return stripped.isBlank() ? "/" : stripped;
        }
        return path;
    }

    private static void sendJson(HttpExchange exchange, int status, String json) throws IOException {
        byte[] data = json.getBytes(StandardCharsets.UTF_8);
        addCommonHeaders(exchange);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, data.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(data);
        }
    }

    private static void sendText(HttpExchange exchange, int status, String text) throws IOException {
        byte[] data = text.getBytes(StandardCharsets.UTF_8);
        addCommonHeaders(exchange);
        exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        exchange.sendResponseHeaders(status, data.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(data);
        }
    }

    private static void addCommonHeaders(HttpExchange exchange) {
        Headers headers = exchange.getResponseHeaders();
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, X-Request-Id");
        headers.set("X-ARS-Architecture", "java-api-gateway-python-ai-orchestrator");
    }

    private static byte[] readAll(InputStream input) throws IOException {
        if (input == null) {
            return new byte[0];
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) >= 0) {
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static String extension(Path path) {
        String fileName = path.getFileName().toString();
        int index = fileName.lastIndexOf('.');
        return index >= 0 ? fileName.substring(index) : "";
    }

    private static String escapeJson(String value) {
        return value == null ? "" : value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");
    }

    private static String extractJsonString(String json, String field, String fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(json);
        return matcher.find() ? matcher.group(1) : fallback;
    }

    private static String extractJsonBoolean(String json, String field, String fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(true|false)");
        Matcher matcher = pattern.matcher(json);
        return matcher.find() ? matcher.group(1) : fallback;
    }

    private static Map<String, String> contentTypes() {
        Map<String, String> types = new HashMap<>();
        types.put(".html", "text/html; charset=utf-8");
        types.put(".css", "text/css; charset=utf-8");
        types.put(".js", "text/javascript; charset=utf-8");
        types.put(".json", "application/json; charset=utf-8");
        types.put(".svg", "image/svg+xml; charset=utf-8");
        types.put(".png", "image/png");
        types.put(".jpg", "image/jpeg");
        types.put(".jpeg", "image/jpeg");
        types.put(".webp", "image/webp");
        types.put(".ico", "image/x-icon");
        return types;
    }

    private static final class HttpResponse {
        final int status;
        final String body;
        final String contentType;
        final String contentDisposition;

        HttpResponse(int status, String body, String contentType, String contentDisposition) {
            this.status = status;
            this.body = body == null ? "" : body;
            this.contentType = contentType;
            this.contentDisposition = contentDisposition;
        }
    }

    private static final class Config {
        final String host;
        final int port;
        final String appBasePath;
        final String orchestratorUrl;
        final int orchestratorTimeoutMs;
        final Path staticRoot;
        final int threads;

        Config(String host, int port, String appBasePath, String orchestratorUrl, int orchestratorTimeoutMs, Path staticRoot, int threads) {
            this.host = host;
            this.port = port;
            this.appBasePath = normalizeBasePath(appBasePath);
            this.orchestratorUrl = trimTrailingSlash(orchestratorUrl);
            this.orchestratorTimeoutMs = orchestratorTimeoutMs;
            this.staticRoot = staticRoot.toAbsolutePath().normalize();
            this.threads = threads;
        }

        static Config fromEnv() {
            return new Config(
                env("BACKEND_HOST", "0.0.0.0"),
                Integer.parseInt(env("BACKEND_PORT", "8787")),
                env("APP_BASE_PATH", "/agent-roundtable-studio"),
                env("AI_ORCHESTRATOR_URL", "http://127.0.0.1:8790"),
                Integer.parseInt(env("AI_ORCHESTRATOR_TIMEOUT_MS", "90000")),
                Paths.get(env("STATIC_ROOT", "./frontend/dist")),
                Integer.parseInt(env("BACKEND_THREADS", "16"))
            );
        }

        private static String env(String name, String fallback) {
            String value = System.getenv(name);
            return value == null || value.isBlank() ? fallback : value;
        }

        private static String normalizeBasePath(String value) {
            if (value == null || value.isBlank() || "/".equals(value)) {
                return "";
            }
            String normalized = value.startsWith("/") ? value : "/" + value;
            while (normalized.endsWith("/") && normalized.length() > 1) {
                normalized = normalized.substring(0, normalized.length() - 1);
            }
            return normalized;
        }

        private static String trimTrailingSlash(String value) {
            String normalized = value == null || value.isBlank() ? "http://127.0.0.1:8790" : value;
            while (normalized.endsWith("/")) {
                normalized = normalized.substring(0, normalized.length() - 1);
            }
            return normalized;
        }
    }
}
