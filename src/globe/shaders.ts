export const GLOBE_VERTEX = `
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GLOBE_FRAGMENT = `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 sunDirection;
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  vec3 dayColor = texture2D(dayMap, vUv).rgb;
  vec3 nightColor = texture2D(nightMap, vUv).rgb;
  vec3 n = normalize(vNormalW);
  vec3 s = normalize(sunDirection);
  float sunAmount = dot(n, s);
  float mixAmount = smoothstep(-0.12, 0.28, sunAmount);
  vec3 daySide = dayColor * (0.22 + 0.98 * clamp(sunAmount, 0.0, 1.0));
  vec3 nightSide = nightColor * 1.7 + dayColor * 0.045;
  vec3 color = mix(nightSide, daySide, mixAmount);
  float band = (1.0 - smoothstep(0.0, 0.38, abs(sunAmount))) * 0.30;
  color += vec3(0.30, 0.14, 0.04) * band;
  gl_FragColor = vec4(color, 1.0);
}
`;
