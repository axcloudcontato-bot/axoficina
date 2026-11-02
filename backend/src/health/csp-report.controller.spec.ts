import { summarizeCspReport } from './csp-report.controller';

describe('summarizeCspReport', () => {
  it('summarizes a report-uri body in one line and drops query strings from the URLs', () => {
    const line = summarizeCspReport({
      'csp-report': {
        'document-uri': 'https://ofix.axcloud.com.br/convite/abcdefghijklmnopqrstuvwx1234?email=a@b.com',
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'https://evil.example/x.js?token=segredo',
      },
    });
    expect(line).toBe('script-src-elem bloqueado: https://evil.example/x.js em https://ofix.axcloud.com.br/convite/:token');
  });

  it('accepts keys already converted to camelCase and falls back to the violated directive', () => {
    expect(summarizeCspReport({ cspReport: { documentUri: 'https://ofix.axcloud.com.br/painel', violatedDirective: "img-src 'self'", blockedUri: 'inline' } }))
      .toBe("img-src 'self' bloqueado: inline em https://ofix.axcloud.com.br/painel");
  });

  it('keeps control characters out of the log line', () => {
    const line = summarizeCspReport({ 'csp-report': { 'effective-directive': 'script-src', 'blocked-uri': 'a\nFAKE LOG LINE\r', 'document-uri': 'https://ofix.axcloud.com.br/' } });
    expect(line).not.toMatch(/[\r\n]/);
  });

  it('ignores anything that is not a CSP report', () => {
    expect(summarizeCspReport(undefined)).toBeNull();
    expect(summarizeCspReport('texto')).toBeNull();
    expect(summarizeCspReport({ outro: 1 })).toBeNull();
    expect(summarizeCspReport({ 'csp-report': {} })).toBeNull();
  });
});
