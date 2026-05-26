import { Img, Row, Section, Text } from "@react-email/components";

export type EmailLogoProps = {
  /** Absolute base URL of the app — used to resolve /brand/logo.svg */
  appUrl: string;
  /** Mark size in pixels. Default 22. */
  size?: number;
};

/**
 * Horizontally centered brand lockup for email headers.
 * Uses <Img> so major clients (Gmail, Outlook, Apple Mail) render it.
 * Falls back gracefully to "doscientos" alt text when images are blocked.
 */
export function EmailLogo({ appUrl, size = 22 }: EmailLogoProps) {
  const logoSrc = `${appUrl.replace(/\/$/, "")}/brand/logo.svg`;

  return (
    <Section style={{ paddingBottom: 0 }}>
      <Row>
        <td align="center">
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            style={{ margin: "0 auto" }}
          >
            <tbody>
              <tr>
                <td style={{ verticalAlign: "middle", paddingRight: 8 }}>
                  <Img
                    src={logoSrc}
                    alt="doscientos"
                    width={size}
                    height={size}
                    style={{ display: "block" }}
                  />
                </td>
                <td style={{ verticalAlign: "middle" }}>
                  <Text
                    style={{
                      margin: 0,
                      fontFamily:
                        "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: "#111111",
                    }}
                  >
                    doscientos
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </Row>
    </Section>
  );
}
