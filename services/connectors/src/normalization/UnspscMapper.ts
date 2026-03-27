/**
 * Mapeador de categorías a UNSPSC (United Nations Standard Products and Services Code)
 * Nivel de familia (4 dígitos) para clasificación estandarizada.
 */

export interface UNSPSCMapping {
  code: string;
  family: string;
  segment: string;
  label: string;
}

const UNSPSC_TAXONOMY: UNSPSCMapping[] = [
  { code: '4300', family: 'Componentes para tecnología de información',    segment: 'Tecnología de Información',     label: 'Equipos y periféricos TI' },
  { code: '8100', family: 'Servicios de ingeniería y arquitectura',        segment: 'Servicios de Ingeniería',       label: 'Consultoría e ingeniería' },
  { code: '7200', family: 'Servicios de construcción y mantenimiento',     segment: 'Construcción y Mantenimiento',  label: 'Obras civiles y construcción' },
  { code: '9100', family: 'Servicios de salud',                            segment: 'Servicios de Salud',            label: 'Salud y medicina' },
  { code: '7800', family: 'Servicios de transporte y almacenamiento',      segment: 'Transporte',                    label: 'Logística y transporte' },
  { code: '4600', family: 'Artículos de laboratorio y científicos',        segment: 'Laboratorio',                   label: 'Equipos de laboratorio' },
  { code: '9200', family: 'Servicios educativos y de formación',           segment: 'Educación',                     label: 'Capacitación y educación' },
  { code: '7600', family: 'Servicios de limpieza y mantenimiento',         segment: 'Mantenimiento y Reparación',    label: 'Aseo y limpieza' },
  { code: '5100', family: 'Materias primas',                               segment: 'Materias Primas y Minería',     label: 'Minería y materias primas' },
  { code: '1500', family: 'Combustibles, lubricantes y gases',             segment: 'Energía y Combustibles',        label: 'Energía y combustibles' },
  { code: '2000', family: 'Equipos de minería y extracción',               segment: 'Minería',                       label: 'Equipos mineros' },
  { code: '3900', family: 'Suministros de plomería y calefacción',         segment: 'Construcción',                  label: 'Materiales de construcción' },
  { code: '5600', family: 'Fertilizantes y nutrientes para suelo',         segment: 'Agricultura',                   label: 'Insumos agrícolas' },
  { code: '4800', family: 'Papel y artículos de oficina',                  segment: 'Oficina',                       label: 'Suministros de oficina' },
  { code: '9300', family: 'Política, sociedad y economía',                 segment: 'Servicios Gubernamentales',     label: 'Servicios públicos' },
  { code: '7700', family: 'Servicios de gestión ambiental',                segment: 'Medio Ambiente',                label: 'Servicios ambientales' },
  { code: '7100', family: 'Servicios de auditoría, contabilidad y finanzas', segment: 'Servicios Financieros',       label: 'Asesoría financiera' },
  { code: '8000', family: 'Servicios de gestión y dirección de empresas',  segment: 'Gestión Empresarial',           label: 'Consultoría de gestión' },
  { code: '7300', family: 'Servicios públicos de utilidad',                segment: 'Servicios Básicos',             label: 'Agua, electricidad, gas' },
  { code: '9500', family: 'Servicios de defensa y seguridad nacional',     segment: 'Seguridad',                     label: 'Seguridad y vigilancia' },
];

const KEYWORD_RULES: Array<{ keywords: string[]; code: string }> = [
  { code: '4300', keywords: ['software', 'sistema', 'plataforma', 'aplicacion', 'desarrollo', 'ti', 'informatica', 'tecnologia', 'hardware', 'computador', 'servidor', 'red', 'telecomunicacion', 'digital'] },
  { code: '8100', keywords: ['ingenieria', 'arquitectura', 'consultoria', 'asesoria', 'estudio', 'proyecto', 'diseño', 'peritaje'] },
  { code: '7200', keywords: ['construccion', 'obra', 'edificacion', 'infraestructura', 'pavimento', 'puente', 'camino', 'vialidad', 'habilitacion'] },
  { code: '9100', keywords: ['salud', 'medic', 'hospital', 'clinica', 'farmaco', 'medicamento', 'insumo medico', 'equipamiento medico', 'dental', 'quirurgico'] },
  { code: '7800', keywords: ['transporte', 'flota', 'vehiculo', 'camion', 'bus', 'traslado', 'flete', 'logistica', 'courier', 'mensajeria'] },
  { code: '4600', keywords: ['laboratorio', 'reactivo', 'equipos analisis', 'cientifico', 'quimico'] },
  { code: '9200', keywords: ['capacitacion', 'formacion', 'entrenamiento', 'curso', 'educacion', 'taller', 'seminario', 'diplomado'] },
  { code: '7600', keywords: ['limpieza', 'aseo', 'mantencion', 'mantenimiento', 'reparacion', 'jardineria'] },
  { code: '5100', keywords: ['mineria', 'mineral', 'cobre', 'litio', 'extraccion', 'yacimiento', 'salar'] },
  { code: '1500', keywords: ['energia', 'electrica', 'solar', 'combustible', 'petroleo', 'gas', 'bencina', 'diesel', 'eolica'] },
  { code: '2000', keywords: ['equipo minero', 'maquinaria minera', 'perforacion', 'explosivo', 'voladura'] },
  { code: '3900', keywords: ['materiales', 'cemento', 'acero', 'fierro', 'estructuras', 'hormigon'] },
  { code: '5600', keywords: ['agricola', 'agro', 'semilla', 'fertilizante', 'pesticida', 'campo', 'riego'] },
  { code: '4800', keywords: ['oficina', 'papel', 'insumo', 'toner', 'mueble', 'escritorio', 'impresion'] },
  { code: '7700', keywords: ['ambiental', 'residuo', 'reciclaje', 'contaminacion', 'agua potable', 'efluente'] },
  { code: '7100', keywords: ['auditoria', 'contabilidad', 'finanzas', 'contable', 'balance', 'tributario'] },
  { code: '8000', keywords: ['gestion', 'administracion', 'estrategia', 'planificacion', 'procesos', 'organizacion'] },
  { code: '7300', keywords: ['agua', 'alcantarillado', 'saneamiento', 'servicio basico', 'potable'] },
  { code: '9500', keywords: ['seguridad', 'vigilancia', 'guardia', 'ronda', 'alarma', 'monitoreo', 'cctv'] },
  { code: '9300', keywords: ['social', 'comunitario', 'municipal', 'subsidio', 'programa social'] },
];

export function classifyToUNSPSC(title: string, description = '', category?: string): UNSPSCMapping {
  const text = `${title} ${description} ${category ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const scores = new Map<string, number>();

  for (const rule of KEYWORD_RULES) {
    let matchCount = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) matchCount++;
    }
    if (matchCount > 0) {
      scores.set(rule.code, (scores.get(rule.code) ?? 0) + matchCount);
    }
  }

  let bestCode = '4800';
  let bestScore = 0;

  for (const [code, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestCode = code;
    }
  }

  return UNSPSC_TAXONOMY.find((t) => t.code === bestCode) ?? UNSPSC_TAXONOMY[13];
}

export function getUNSPSCByCode(code: string): UNSPSCMapping | undefined {
  return UNSPSC_TAXONOMY.find((t) => t.code === code);
}

export function getAllUNSPSCCodes(): UNSPSCMapping[] {
  return UNSPSC_TAXONOMY;
}
