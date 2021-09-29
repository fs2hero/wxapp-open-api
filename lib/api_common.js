// 本文件用于wechat API，基础文件，主要用于Token的处理和mixin机制
const httpx = require('httpx')
const liburl = require('url')
const WXBizMsgCrypt = require('./WXBizMsgCrypt')

class AccessToken {
  constructor(accessToken, expireTime) {
    this.accessToken = accessToken
    this.expireTime = expireTime
  }

  /* !
   * 检查AccessToken是否有效，检查规则为当前时间和过期时间进行对比
   * Examples:
   * ```
   * token.isValid();
   * ```
   */
  isValid() {
    return !!this.accessToken && Date.now() < this.expireTime
  }
}

/* !
 * 检查ComponentAccessToken是否有效，检查规则为当前时间和过期时间进行对比 * Examples:
 * ```
 * componentAccessToken.isValid();
 * ```
 */
class ComponentAccessToken {
  constructor(componentAccessToken, expireTime) {
    this.componentAccessToken = componentAccessToken
    this.expireTime = expireTime
  }

  /* !
   * 检查AccessToken是否有效，检查规则为当前时间和过期时间进行对比 * Examples:
   * ```
   * token.isValid();
   * ```
   */
  isValid() {
    return (
      !!this.componentAccessToken && new Date().getTime() < this.expireTime
    )
  }
}

class API {
  /**
   * 根据 component_appid、component_appsecret、authorizer_appid、component_verify_ticket 和 getAuthorizerRefreshToken 创建API的构造函数
   * 如需跨进程跨机器进行操作Wechat API（依赖component token 和 access token），component token和access token需要进行全局维护
   * 使用策略如下：
   * 1. 调用用户传入的获取token的异步方法，获得token之后使用
   * 2. 使用component/api_component_token获取component_token。并调用用户传入的保存component_token方法保存
   * 3. 使用component/api_authorizer_token获取token。并调用用户传入的保存token方法保存
   * Tips:
   * - 如果跨机器运行wechat模块，需要注意同步机器之间的系统时间。
   * Examples:
   * ```
   * var API = require('co-open-wechat-api');
   * var api = new API('component_appid', 'component_appsecret', 'authorizer_appid', 'component_verify_ticket', getAuthorizerRefreshToken: async (authorizer_appid) => { });
   * ```
   * 以上即可满足单进程使用。
   * 当多进程时，component token和access token需要全局维护，以下为保存component token和access token的接口。
   * ```
   * var api = new API('component_appid', 'component_appsecret', 'authorizer_appid', 'component_verify_ticket', getAuthorizerRefreshToken: async (authorizer_appid) => { } , async function () {
   *   // 传入一个获取全局component_token的方法
   *   var txt = await fs.readFile('component_token.txt', 'utf8');
   *   return JSON.parse(txt);
   * }, async function (component_token) {
   *   // 请将component_token存储到全局，跨进程、跨机器级别的全局，比如写到数据库、redis等
   *   // 这样才能在cluster模式及多机情况下使用，以下为写入到文件的示例
   *   await fs.writeFile('component_token.txt', JSON.stringify(component_token));
   * }, async function () {
   *   // 传入一个获取全局token的方法
   *   var txt = await fs.readFile('appid_token.txt', 'utf8');
   *   return JSON.parse(txt);
   * }, async function (token) {
   *  // 请将token存储到全局，跨进程、跨机器级别的全局，比如写到数据库、redis等
   *  // 这样才能在cluster模式及多机情况下使用，以下为写入到文件的示例
   *   await fs.writeFile('appid_token.txt', JSON.stringify(token));
   * });
   * ```
   * @param {String} componentAppid 第三方平台appid
   * @param {String} componentAppSecret 第三方平台appSecret
   * @param {String} componentVerifyTicket 微信后台推送的ticket，此ticket会定时推送，具体参考文档：推送component_verify_ticket协议 https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1453779503&lang=zh_CN
   * @param {String} authorizerAppid  授权方 appId
   * @param {String} authorizer_refresh_token 授权方的刷新令牌，刷新令牌主要用于第三方平台获取和刷新已授权用户的authorizer_refresh_token，只会在授权时刻提供，请妥善保存。一旦丢失，只能让用户重新授权，才能再次拿到新的刷新令牌
   * @param {Generator} getComponentToken 可选的。获取全局component_token对象的方法，多进程模式部署时需在意
   * @param {Generator} saveComponentToken 可选的。保存全局component_token对象的方法，多进程模式部署时需在意
   * @param {Generator} getToken 可选的。获取全局token对象的方法，多进程模式部署时需在意
   * @param {Generator} saveToken 可选的。保存全局token对象的方法，多进程模式部署时需在意
   * @param {Generator} getAuthorizerRefreshToken 可选的。授权方的刷新令牌，如定义此方法，authorizer_refresh_token可传空串。 刷新令牌主要用于第三方平台获取和刷新已授权用户的authorizer_refresh_token，只会在授权时刻提供，请妥善保存。一旦丢失，只能让用户重新授权，才能再次拿到新的刷新令牌
   * @param {Generator} getComponentVerifyTicket 可选的。获取componentVerifyTicket的方法，如定义此方法，componentVerifyTicket可传空串
   * @param {Generator} acquiredLocker 可选的。 返回分布式锁的函数，返回释放锁的函数。用于获取 component/api_component_token获取component_token 和 component/api_authorizer_token获取token 加分布式加锁
   */
  constructor(
    componentAppid,
    componentAppSecret,
    componentVerifyTicket,
    authorizerAppid,
    authorizer_refresh_token,
    getComponentToken,
    saveComponentToken,
    getToken,
    saveToken,
    getAuthorizerRefreshToken,
    getComponentVerifyTicket,
    acquiredLocker
  ) {
    this.component_appid = componentAppid
    this.component_appsecret = componentAppSecret
    this.appid = authorizerAppid
    this.component_verify_ticket = componentVerifyTicket
    this.authorizer_refresh_token = authorizer_refresh_token
    this.getComponentToken =
      getComponentToken ||
      async function () {
        return this.ComponentTokenStore
      }
    this.saveComponentToken =
      saveComponentToken ||
      async function (componentToken) {
        this.ComponentTokenStore = componentToken
        if (process.env.NODE_ENV === 'production') {
          console.warn(
            "Don't save component token in memory, when cluster or multi-computer!"
          )
        }
      }
    this.getToken =
      getToken ||
      async function (authorizerAppid) {
        return this.store
      }
    this.saveToken =
      saveToken ||
      async function (authorizerAppid, token) {
        this.store = token
        if (process.env.NODE_ENV === 'production') {
          console.warn(
            "Don't save token in memory, when cluster or multi-computer!"
          )
        }
      }
    this.getAuthorizerRefreshToken =
      getAuthorizerRefreshToken ||
      async function (authorizerAppid) {
        return this.authorizer_refresh_token
      }
    this.getComponentVerifyTicket =
      getComponentVerifyTicket ||
      async function () {
        return this.component_verify_ticket
      }
    this.acquiredLocker =
      acquiredLocker ||
      async function () {
        const unlock = () => { }
        return unlock
      }

    this.prefix = 'https://api.weixin.qq.com/cgi-bin/'
    this.wxappPrefix = 'https://api.weixin.qq.com/wxa/'
    this.wxaapiPrefix = 'https://api.weixin.qq.com/wxaapi/'
    this.wxopenPrefix = 'https://api.weixin.qq.com/cgi-bin/wxopen/'
    this.mediaPrefix = 'https://api.weixin.qq.com/cgi-bin/media/'
    this.datacubePrefix = 'https://api.weixin.qq.com/datacube/'
    this.openPrefix = 'https://api.weixin.qq.com/cgi-bin/open'
    this.templatePrefix = 'https://api.weixin.qq.com/cgi-bin/wxopen/template/'
    this.newTemplatePrefix = 'https://api.weixin.qq.com/wxaapi/newtmpl/'
    this.templateMessagePrefix = 'https://api.weixin.qq.com/cgi-bin/message/wxopen/template/'
    this.customMessagePrefix = 'https://api.weixin.qq.com/cgi-bin/message/custom/'
    this.subscribeMessagePrefix = 'https://api.weixin.qq.com/cgi-bin/message/subscribe/'
    this.mallPrefix = 'https://api.weixin.qq.com/mall/'
    this.expressBusinessPrefix = 'https://api.weixin.qq.com/cgi-bin/express/business/'
    this.expressLocalBusinessPrefix = 'https://api.weixin.qq.com/cgi-bin/express/local/business/'
    this.defaults = {}
    this.hooks = {
      requestSpeed:(authorizerAppid, time, url, options, error) => {}
    }
  }

  setRequestSpeedHook(hook) {
    if(hook) {
      this.hooks.requestSpeed = hook
    }
  }

  /**
   * 设置urllib的hook
   */
  async request(url, opts, retry) {
    if (typeof retry === 'undefined') {
      retry = 3
    }

    const startTime = Date.now()
    const requestSpeedHook = this.hooks.requestSpeed.bind(this, this.authorizerAppid)
    var options = {}
    Object.assign(options, this.defaults)
    opts || (opts = {})
    var keys = Object.keys(opts)
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      if (key !== 'headers') {
        options[key] = opts[key]
      } else {
        if (opts.headers) {
          options.headers = options.headers || {}
          Object.assign(options.headers, opts.headers)
        }
      }
    }
    options.headers  = options.headers || {}
    if(!options.headers['content-type']) {
        options.headers['content-type'] = 'application/json'
    }

    if(typeof options.data === 'object') {
        options.data = JSON.stringify(options.data)
    }
    options.timeout = options.timeout || 100000
    var res = await httpx.request(url, options)
    if (res.statusCode < 200 || res.statusCode > 204) {
      var err = new Error(`url: ${url}, status code: ${res.statusCode}`)
      err.name = 'WeChatAPIError'
      requestSpeedHook(Date.now() - startTime, url, options, err)

      throw err
    }

    var buffer = await httpx.read(res)
    var contentType = res.headers['content-type'] || ''
    if (contentType.indexOf('application/json') !== -1) {
      var data
      try {
        data = JSON.parse(buffer)
      } catch (ex) {
        let err = new Error('JSON.parse error. buffer is ' + buffer.toString())
        err.name = 'WeChatAPIError'
        requestSpeedHook(Date.now() - startTime, url, options, err)

        throw err
      }

      if (data && data.errcode) {
        let err = new Error(data.errmsg)
        err.name = 'WeChatAPIError'
        err.code = data.errcode
        requestSpeedHook(Date.now() - startTime, url, options, err)

        if (err.code === 40001 && retry > 0) {
          // 销毁已过期的token
          await this.saveToken(this.appid, null)
          let token = await this.getAccessToken()
          let urlobj = new liburl.URL(url); //liburl.parse(url, true)

          if (urlobj.searchParams && urlobj.searchParams.get('access_token')) {
            urlobj.searchParams.set('access_token', token.accessToken)
            delete urlobj.search
          }
          // if (urlobj.query && urlobj.query.access_token) {
          //   urlobj.query.access_token = token.accessToken
          //   delete urlobj.search
          // }

          return this.request(liburl.format(urlobj), opts, retry - 1)
        }

        throw err
      }

      requestSpeedHook(Date.now() - startTime, url, options, null)
      return data
    }

    requestSpeedHook(Date.now() - startTime, url, options, null)
    return buffer
  }

  /* !
   * 根据创建API时传入的平台appid和授权方的appid和刷新授权令牌的authorizer_refresh_token
   * 进行后续所有API调用时，需要先获取access token
   * 详细请看：<http://mp.weixin.qq.com/wiki/index.php?title=获取access_token> * 应用开发者无需直接调用本API。 * Examples:
   * ```
   * var token = await api.getAccessToken();
   * ```
   * - `err`, 获取access token出现异常时的异常对象
   * - `result`, 成功时得到的响应结果 * Result:
   * ```
   * {"authorizer_access_token": "authorizer_access_token","expires_in": 7200}
   * ```
   */
  async getAccessToken() {
    const componentAccessToken = await this.getComponentAccessToken()
    const url = this.prefix + 'component/api_authorizer_token?component_access_token=' +
      componentAccessToken.componentAccessToken
    const unlock = await this.acquiredLocker()
    if (!unlock) {
      throw new Error(
        `getAccessToken acquiredLocker error ${this.appid}`
      )
    }

    try {
      const tryGetToken = await this.getToken(this.appid)
      let accessToken
      if (
        tryGetToken &&
        (accessToken = new AccessToken(
          tryGetToken.accessToken,
          tryGetToken.expireTime
        )).isValid()
      ) {
        unlock()
        return accessToken
      }

      const authorizer_refresh_token = await this.getAuthorizerRefreshToken(this.appid)
      const params = {
        component_appid: this.component_appid,
        authorizer_appid: this.appid,
        authorizer_refresh_token
      }
      const options = {
        method: 'post',
        data: params
      }
      const data = await this.request(url, options)
      // 过期时间，因网络延迟等，将实际过期时间提前10秒，以防止临界点
      const expireTime = new Date().getTime() + (data.expires_in - 10) * 1000
      const token = new AccessToken(data.authorizer_access_token, expireTime)
      await this.saveToken(this.appid, token)
      unlock()
      return token
    } catch (err) {
      unlock()

      throw err
    }
  }

  /* !
   * 根据创建API时传入的平台component_appid和component_appsecret和微信服务器推送的component_verify_ticket
   * 进行刷新accesstokenAPI调用时
   * 详细请看：<https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1453779503&lang=zh_CN>  * Examples:
   * ```
   * var token = await api.getComponentAccessToken();
   * ```
   * - `err`, 获取access token出现异常时的异常对象
   * - `result`, 成功时得到的响应结果 * Result:
   * ```
   * {"component_access_token": "component_access_token","expires_in": 7200}
   * ```
   */
  async getComponentAccessToken() {
    const url = this.prefix + 'component/api_component_token'
    const componentVerifyTicket = await this.getComponentVerifyTicket()

    const params = {
      component_appid: this.component_appid,
      component_appsecret: this.component_appsecret,
      component_verify_ticket: componentVerifyTicket
    }

    const options = {
      method: 'post',
      data: params,
      timeout: 10000
    }

    const unlock = await this.acquiredLocker()
    if (!unlock) {
      throw new Error(
        `getComponentAccessToken acquiredLocker error`
      )
    }

    try {
      const tryGetComponentAccessToken = await this.getComponentToken()
      let accessToken
      if (
        tryGetComponentAccessToken &&
        (accessToken = new ComponentAccessToken(
          tryGetComponentAccessToken.componentAccessToken,
          tryGetComponentAccessToken.expireTime
        )).isValid()
      ) {
        unlock()
        return accessToken
      }

      const data = await this.request(url, options)
      // 过期时间，因网络延迟等，将实际过期时间提前10秒，以防止临界点
      const expireTime = new Date().getTime() + (data.expires_in - 10) * 1000
      const componentToken = new ComponentAccessToken(
        data.component_access_token,
        expireTime
      )
      await this.saveComponentToken(componentToken)
      unlock()
      return componentToken
    } catch (err) {
      unlock()

      throw err
    }
  }

  /* !
   * 需要access token的接口调用如果采用preRequest进行封装后，就可以直接调用。
   * 无需依赖 getAccessToken 为前置调用。
   * 应用开发者无需直接调用此API。
   * Examples:
   * ```
   * await api.ensureAccessToken();
   * ```
   */
  async ensureAccessToken() {
    // 调用用户传入的获取token的异步方法，获得token之后使用（并缓存它）。
    const token = await this.getToken(this.appid)
    let accessToken
    if (
      token &&
      (accessToken = new AccessToken(
        token.accessToken,
        token.expireTime
      )).isValid()
    ) {
      return accessToken
    }
    return this.getAccessToken()
  }

  /* !
   * 需要access token的接口调用如果采用preRequest进行封装后，就可以直接调用。
   * 无需依赖 getComponentAccessToken 为前置调用。
   * 应用开发者无需直接调用此API。
   * Examples:
   * ```
   * await api.ensureComponentToken();
   * ```
   */
  async ensureComponentToken() {
    const componentAccessToken = await this.getComponentToken()
    let accessToken
    if (
      componentAccessToken &&
      (accessToken = new ComponentAccessToken(
        componentAccessToken.componentAccessToken,
        componentAccessToken.expireTime
      )).isValid()
    ) {
      return accessToken
    }
    return this.getComponentAccessToken()
  }
}

/**
 * 用于支持对象合并。将对象合并到API.prototype上，使得能够支持扩展
 * Examples:
 * ```
 * // 媒体管理（上传、下载）
 * API.mixin(require('./lib/api_media'));
 * ```
 * @param {Object} obj 要合并的对象
 */
API.mixin = function (obj) {
  for (const key in obj) {
    if (API.prototype.hasOwnProperty(key)) {
      throw new Error(
        "Don't allow override existed prototype method. method: " + key
      )
    }
    API.prototype[key] = obj[key]
  }
}

API.AccessToken = AccessToken
API.ComponentAccessToken = ComponentAccessToken
API.WXBizMsgCrypt = WXBizMsgCrypt

module.exports = API
