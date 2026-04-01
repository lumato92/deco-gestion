// src/lib/pdf/base.tsx
// Estilos y componentes compartidos entre todos los PDFs de SU Home

import { StyleSheet, Font } from '@react-pdf/renderer'

export const BRAND = {
  nombre:     'SU Home',
  sub:        'Decoración & Diseño',
  direccion:  'Arenales 1245, CABA, Argentina',
  whatsapp:   '11 3878 2918',
  instagram:  '@su.home.ba',
  horario:    'Lun–Vie 11 a 19 hs  ·  Sáb 10 a 14 hs',
}

export const COLORS = {
  black:      '#1a1a1a',
  gray:       '#666666',
  lightGray:  '#999999',
  ultraLight: '#bbbbbb',
  border:     '#eeeeee',
  bg:         '#f8f8f8',
  green:      '#2a7a5a',
  red:        '#c0392b',
}

export const baseStyles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingTop: 0,
    paddingBottom: 0,
    fontFamily: 'Helvetica',
    color: COLORS.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.black,
    borderBottomStyle: 'solid',
  },
  logoArea: {
    flexDirection: 'column',
    gap: 4,
  },
  logo: {
    width: 52,
    height: 40,
    objectFit: 'contain',
  },
  brandName: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.black,
    marginTop: 6,
    fontFamily: 'Helvetica-Bold',
  },
  brandSub: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: COLORS.lightGray,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 28,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    borderTopStyle: 'solid',
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 8,
    color: COLORS.ultraLight,
    lineHeight: 1.6,
  },
  sectionTitle: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: COLORS.ultraLight,
    marginBottom: 10,
    fontFamily: 'Helvetica-Bold',
  },
  fieldLabel: {
    fontSize: 8,
    color: COLORS.ultraLight,
    letterSpacing: 1,
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  fieldValue: {
    fontSize: 11,
    color: COLORS.black,
    lineHeight: 1.4,
  },
  fieldValueSm: {
    fontSize: 10,
    color: COLORS.gray,
    lineHeight: 1.4,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
    marginVertical: 20,
  },
})