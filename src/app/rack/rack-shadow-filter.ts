import { ShaderChunk } from 'three';

/**
 * PCF fijo para las luces direccionales del rack. El patrón no cambia entre
 * píxeles, de modo que una penumbra amplia no se convierte en grano visible.
 * Las 16 lecturas usan también la interpolación PCF de la propia GPU.
 */
const directionalPcf = /* glsl */ `
  float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
    float shadow = 1.0;

    shadowCoord.xyz /= shadowCoord.w;
    shadowCoord.z += shadowBias;

    bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
    bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

    if ( frustumTest ) {
      const vec4 offsets = vec4( -1.0, -1.0 / 3.0, 1.0 / 3.0, 1.0 );
      const vec4 weights = vec4( 1.0, 3.0, 3.0, 1.0 );
      vec2 texelRadius = vec2( shadowRadius ) / shadowMapSize;
      shadow = 0.0;

      for ( int y = 0; y < 4; y ++ ) {
        for ( int x = 0; x < 4; x ++ ) {
          vec2 offset = vec2( offsets[ x ], offsets[ y ] ) * texelRadius;
          shadow += weights[ x ] * weights[ y ] * texture(
            shadowMap, vec3( shadowCoord.xy + offset, shadowCoord.z )
          );
        }
      }

      shadow *= 1.0 / 64.0;
    }

    return mix( 1.0, shadow, shadowIntensity );
  }

`;

function createRackShadowChunk(): string {
  const source = ShaderChunk.shadowmap_pars_fragment;
  const signature = 'float getShadow( sampler2DShadow shadowMap,';
  const nextBranch = '#elif defined( SHADOWMAP_TYPE_VSM )';
  const start = source.indexOf(signature);
  const end = source.indexOf(nextBranch, start);

  // Si Three cambia la estructura del shader, fallar explícitamente evita
  // publicar el filtro anterior en silencio o modificar otra clase de sombra.
  if (
    start < 0 ||
    end <= start ||
    source.indexOf(signature, start + signature.length) !== -1 ||
    source.indexOf(nextBranch, end + nextBranch.length) !== -1
  ) {
    throw new Error('El shader de sombras de Three no contiene la sección PCF esperada.');
  }

  // La sustitución es local a los materiales del rack. Se conservan las
  // declaraciones, las ramas VSM/Basic y las sombras de luces puntuales.
  return source.slice(0, start) + directionalPcf + source.slice(end);
}

/** Reemplaza #include <shadowmap_pars_fragment> dentro de onBeforeCompile. */
export const RACK_SHADOW_FILTER_CHUNK = createRackShadowChunk();
