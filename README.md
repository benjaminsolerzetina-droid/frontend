# Rack de inventario

Modelo interactivo en Angular y Three.js, con vista superior y tres vistas anguladas. La geometría, el acabado y la iluminación se ajustan por separado.

## Ejecutar

Con Node.js y npm instalados, desde esta carpeta:

```sh
npm ci
npm start
```

Abrir [localhost:4200](http://localhost:4200). Los cambios en los archivos actualizan la vista automáticamente.

## Ajustar el modelo

| Parámetros               | Archivo                           | Qué controlan                                                                                                                                                                        |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RACK_MEASUREMENTS`      | `src/app/rack/rack.config.ts`     | Filas, columnas, tamaño y profundidad de piezas, biseles, teselas, accesorios, márgenes y pasillos. Las medidas usan píxeles de referencia; `PX` las convierte a unidades de escena. |
| `FINISH`                 | `src/app/rack/rack-appearance.ts` | Textura, escala del grano, rugosidad, relieve y acabado claro de los cantos frontales.                                                                                                                   |
| `CLUSTER_FINISH`         | `src/app/rack/rack-appearance.ts` | Color, rugosidad, relieve y perfil de biseles de cada cuadrante: A superior izquierdo, B superior derecho, C inferior izquierdo y D inferior derecho.                                |
| `ACCESSORY_FINISH`       | `src/app/rack/rack-appearance.ts` | Tonos individuales de los accesorios redondeados y de cada panel de teselas.                                                                                                         |
| `STUDIO`                 | `src/app/rack/rack-appearance.ts` | Perspectiva de cámara, suavidad y resolución de sombras, tamaño del fondo, variación de tono y duración de las transiciones.                                                                                |
| `LIGHT` y `COLORS`       | `src/app/rack/rack.config.ts`     | Dirección y reparto de luz, y colores del fondo, la placa y los cilindros.                                                                                                           |
| `AO`, `RENDER` y `VIEWS` | `src/app/rack/rack.config.ts`     | Oscurecimiento de contacto, límites de resolución y orientación de las vistas.                                                                                                       |

La escala de textura (`textureSpan`) y los perfiles de bisel usan píxeles de referencia. `relief` expresa la intensidad del material y se aplica directamente, sin conversión por `PX`.

`createRackLayout` calcula los pasos de la rejilla, las plataformas, las posiciones de los cuatro grupos y el tamaño del tablero. Al cambiar filas o columnas, adapta los accesorios laterales y centra los paneles inferiores, ajustando su cantidad de teselas sin estirarlas. El encuadre se calcula desde los límites de la geometría para cada vista y tamaño de ventana.

## Verificar y compilar

```sh
node ./node_modules/@angular/cli/bin/ng.js test --watch=false
npm run build
```

Las pruebas comprueban distribución, límites, ausencia de cruces y encuadre de cámara. La compilación de producción se guarda en `dist/frontend/browser`.
