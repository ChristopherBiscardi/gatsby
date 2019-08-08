import path from "path"
import ShadowingPlugin from "../"

// allow writing paths like path/to/thing, even on windows
const xplatPath = uri => uri.split(`/`).join(path.sep)
describe(`Component Shadowing`, () => {
  it.each([
    [
      // simple request path to a theme's component
      `/some/place/a-theme/src/components/a-component`,
      {
        themeDir: `/some/place/a-theme`,
        themeName: `a-theme`,
      },
    ],
    [
      // request to a shadowed component in theme b
      // component-path is expected to be `a-theme/components/a-component`
      `/some/place/theme-b/src/a-theme/components/a-component`,
      {
        themeDir: `/some/place/theme-b`,
        themeName: `theme-b`,
      },
    ],
  ])(`gets matching themes`, (componentFullPath, { themeDir, themeName }) => {
    const plugin = new ShadowingPlugin({
      themes: [`a-theme`, `theme-b`, `gatsby-theme-c`, `@orgname/theme-d`].map(
        name => {
          return {
            themeName: name,
            themeDir: xplatPath(`/some/place/${name}`),
          }
        }
      ),
    })
    expect(
      plugin.getMatchingThemesForPath(xplatPath(componentFullPath))
    ).toEqual([
      {
        themeDir: xplatPath(themeDir),
        themeName,
      },
    ])
  })

  it.each([
    [
      {
        // issuer is in `theme-b`
        issuerPath: `/some/node_modules/theme-b/src/a-theme/components/a-component`,
        // require'ing a file it is a "shadow child" of in a-theme
        requestPath: `/some/node_modules/a-theme/src/components/a-component`,
        userSiteDir: `/some`,
      },
      true,
    ],
    [
      {
        // issuer is in `theme-b`
        issuerPath: `/some/node_modules/theme-b/src/a-theme/components/a-component`,
        // require'ing a file it is NOT a "shadow child" of, also in theme-b
        // the `component-path` here would be "components/a-component"
        requestPath: `/some/node_modules/theme-b/src/components/a-component`,
        userSiteDir: `/some`,
      },
      false,
    ],
    [
      {
        // issuer is in the user's site
        issuerPath: `/some/src/theme-b/components/a-component`,
        // require'ing a file it is a "shadow child" of
        requestPath: `/some/node_modules/theme-b/src/components/a-component`,
        userSiteDir: `/some`,
      },
      true,
    ],
    [
      {
        // issuer is in the user's site
        issuerPath: `/some/src/@orgname/theme-d/components/a-component`,
        // require'ing a file it is a "shadow child" of
        requestPath: `/some/node_modules/@orgname/theme-d/src/components/a-component`,
        userSiteDir: `/some`,
      },
      true,
    ],
  ])(
    `can determine if the request path is in the shadow chain for the issuer`,
    ({ issuerPath, requestPath, userSiteDir }, result) => {
      const plugin = new ShadowingPlugin({
        themes: [
          `a-theme`,
          `theme-b`,
          `gatsby-theme-c`,
          `@orgname/theme-d`,
        ].map(name => {
          return {
            themeName: name,
            themeDir: xplatPath(`/some/node_modules/${name}`),
          }
        }),
      })
      expect(
        plugin.requestPathIsIssuerShadowPath({
          // issuer is in `theme-b`
          issuerPath: xplatPath(issuerPath),
          // require'ing a file it is a "shadow child" of in a-theme
          requestPath: xplatPath(requestPath),
          userSiteDir: xplatPath(userSiteDir),
        })
      ).toEqual(result)
    }
  )

  const route = routing => dirname => {
    if (routing[dirname]) {
      return routing[dirname]
    } else {
      throw new Error(
        `dir '${dirname}' is not handled by fake readdirSync for component shadowing test in routing table ${routing}`
      )
    }
  }
  it.each(
    [
      [
        // shadowing a styles.css file
        {
          matchingTheme: `theme-a`,
          themes: [
            {
              themeName: `theme-a`,
              themeDir: `/a-theme`,
            },
          ],
          component: `/styles.css`,
        },
        {
          fs: {
            readdirSync: route({
              "/fake-site-root/src/theme-a": [`irrelevant-dir`, `styles.css`],
            }),
          },
          pathResolve: route({ ".": `/fake-site-root` }),
        },
        `/fake-site-root/src/theme-a/styles.css`,
      ],
      [
        // shadowing a templates/template.js file
        {
          matchingTheme: `theme-a`,
          themes: [
            {
              themeName: `theme-a`,
              themeDir: `/a-theme`,
            },
            {
              themeName: `theme-b`,
              themeDir: `/b-theme`,
            },
          ],
          component: `/templates/template.js`,
        },
        {
          fs: {
            readdirSync: route({
              "/b-theme/src/theme-a": [`template.js`],
            }),
          },
          pathResolve: route({ ".": `/fake-site-root` }),
        },
        `/b-theme/src/theme-a/templates/template.js`,
      ],
      [
        // shadowing a .tsx file with `.` in the name with a .js file
        {
          matchingTheme: `theme-a`,
          themes: [
            {
              themeName: `theme-a`,
              themeDir: `/a-theme`,
            },
          ],
          component: `/Thing.Whatever.My.tsx`,
        },
        {
          fs: {
            readdirSync: route({
              "/fake-site-root/src/theme-a": [
                `irrelevant-dir`,
                `Thing.Whatever.My.js`,
              ],
            }),
          },
          pathResolve: route({ ".": `/fake-site-root` }),
        },
        `/fake-site-root/src/theme-a/Thing.Whatever.My.js`,
      ],
    ],
    `resolves components`,
    ({ matchingTheme, themes, component }, system, result) => {
      // shadowing plugin options don't matter. resolveComponentPath is pure
      const plugin = new ShadowingPlugin()
      expect(
        plugin.resolveComponentPath(
          { matchingTheme, themes, component },
          system
        )
      ).toEqual(result)
    }
  )
})
