# WokiBrain

Motor de reservas para restaurantes con selección automática de mesas y soporte para combinaciones.

> **English version:** [README.md](./README.md)

## Inicio Rápido

```bash
npm install
npm run dev
```

El servidor corre en http://localhost:3000

### Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | Compilar TypeScript |
| `npm start` | Ejecutar app compilada |
| `npm test` | Ejecutar tests |

## Stack Tecnológico

- **Runtime:** Node.js 18+
- **Framework:** Fastify
- **Validación:** Zod
- **Logging:** Pino
- **Testing:** Vitest
- **Almacenamiento:** En memoria (se reinicia con el servidor)

## Endpoints de la API

### `GET /woki/discover`

Buscar slots disponibles sin crear una reserva.

```
GET /woki/discover?restaurantId=R1&sectorId=S1&date=2025-10-22&partySize=5&duration=90
```

Opcionales: `windowStart`, `windowEnd`, `limit`

### `POST /woki/bookings`

Crear una reserva. WokiBrain selecciona automáticamente la(s) mejor(es) mesa(s).

```json
{
  "restaurantId": "R1",
  "sectorId": "S1",
  "partySize": 5,
  "durationMinutes": 90,
  "date": "2025-10-22",
  "windowStart": "20:00",
  "windowEnd": "23:45"
}
```

Soporta header `Idempotency-Key` (TTL de 60s).

### `GET /woki/bookings/day`

Listar reservas de un día específico.

```
GET /woki/bookings/day?restaurantId=R1&sectorId=S1&date=2025-10-22
```

### `DELETE /woki/bookings/:id`

Cancelar una reserva. Retorna 204.

## Diseño del Algoritmo

### Heurística de Capacidad para Combos

Para combinaciones de mesas, la capacidad se calcula como sumas simples:

```
comboMin = suma de todos los valores minSize
comboMax = suma de todos los valores maxSize
```

Ejemplo: Mesas A (2-4) + B (4-6) = Capacidad del combo 6-10

Se eligió este enfoque por simplicidad y predictibilidad. No se aplican penalidades de fusión ya que las mesas de restaurante típicamente mantienen su capacidad individual cuando se combinan.

### Estrategia de Selección de WokiBrain

El algoritmo puntúa cada slot candidato y elige el de menor puntaje:

```
puntaje = (desperdicio × 100) + (cantidadMesas × 10) + minutosDesdeInicioVentana
```

**Factores (en orden de prioridad):**

1. **Minimizar desperdicio (×100):** Preferir mesas más cercanas al tamaño del grupo
2. **Preferir mesas individuales (×10):** Leve penalidad por cada mesa en combo
3. **Slots más tempranos (×1):** Desempate favorece disponibilidad más temprana

**Desempate:** Alfabético por ID de la primera mesa (garantiza determinismo)

**Por qué esta estrategia:**
- Minimiza asientos sin usar (eficiente para el restaurante)
- Prefiere configuraciones simples (mesas individuales sobre combos)
- Determinístico: mismas entradas siempre producen la misma salida

### Descubrimiento de Gaps

1. Para cada mesa, encontrar gaps entre reservas existentes dentro de las ventanas de servicio
2. Para combos, intersectar conjuntos de gaps para encontrar horarios donde todas las mesas estén libres
3. Generar slots alineados a la grilla de 15 minutos
4. Los intervalos son `[inicio, fin)` — reservas adyacentes no entran en conflicto

### Control de Concurrencia

**Formato de lock key:** `{sectorId}|{mesa1}+{mesa2}+...|{horaInicio}`

Las mesas se ordenan alfabéticamente. El lock se adquiere antes de escribir y se libera en el bloque `finally`.

## Testing con Bruno

Usamos [Bruno](https://www.usebruno.com/) para testing de API porque:

- **Amigable con Git:** Los tests son archivos de texto plano, fáciles de ver diffs y revisar
- **Sin sincronización en la nube:** Todo queda local, no requiere cuenta
- **Formato legible:** Los archivos `.bru` son legibles por humanos

### Ejecutar Tests

1. Instalar Bruno (https://www.usebruno.com/downloads)
2. Abrir la carpeta `bruno/` como colección
3. Seleccionar el ambiente "local"
4. Ejecutar requests individualmente o usar el Runner

### Archivos de Test

| Archivo | Escenario |
|---------|-----------|
| `discover-slots.bru` | Caso exitoso - encontrar slots disponibles |
| `discover-no-capacity.bru` | Grupo demasiado grande |
| `discover-outside-window.bru` | Request fuera del horario de servicio |
| `create-booking.bru` | Crear reserva válida |
| `create-booking-no-capacity.bru` | Sin capacidad retorna 409 |
| `get-bookings-day.bru` | Listar reservas del día |
| `delete-booking.bru` | Cancelar reserva |

## Códigos de Error

| Status | Código | Cuándo |
|--------|--------|--------|
| 400 | `invalid_input` | Formato inválido, horarios fuera de grilla, campos faltantes |
| 404 | `not_found` | Restaurante/sector/reserva no encontrado |
| 409 | `no_capacity` | Ninguna mesa individual ni combo cumple los requisitos |
| 422 | `outside_service_window` | Ventana solicitada fuera del horario de servicio |

## Decisiones de Diseño

### Por qué Almacenamiento en Memoria (Sin Base de Datos)

Siguiendo la especificación del ejercicio (§3, §9), usamos almacenamiento en memoria en lugar de PostgreSQL/Docker:

- **Requisito del ejercicio:** "Persistence: In-memory" está explícitamente listado en los requisitos técnicos
- **Simplicidad:** Sin setup de Docker, sin migraciones de base de datos, sin connection strings
- **Cero dependencias:** `npm install && npm run dev` funciona directo
- **Foco en algoritmos:** El challenge evalúa descubrimiento de gaps, intersección de combos, y selección WokiBrain — no operaciones de base de datos

Para producción, las interfaces del store (`db.ts`) podrían intercambiarse por una base de datos real sin cambiar la lógica de negocio.

### Por qué Fastify sobre Express

- Soporte nativo de TypeScript con validación basada en schemas
- Mejor performance out of the box
- Patrones async/await más limpios

### Por qué Bruno para Testing de API

- **Trackeable en Git:** Los archivos `.bru` son texto plano, fáciles de ver diffs y revisar en PRs
- **Sin cuenta requerida:** A diferencia de Postman, todo queda local
- **Formato legible:** Sintaxis legible por humanos sin anidamiento JSON

## Datos

Los datos semilla se cargan desde `src/data/seed.json` al iniciar. Incluye un restaurante con 5 mesas (rango de capacidad 2-6 por mesa).
