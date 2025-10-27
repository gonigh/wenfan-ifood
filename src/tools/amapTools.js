// 高德地图工具模块
const AmapTools = (function() {
    // 高德地图API密钥（需要用户配置）
    let API_KEY = '6dcd4bcf74fec41544901b877b1fd7bb';

    // 缓存的用户位置信息
    let cachedLocation = null;

    /**
     * 通过IP定位获取用户当前位置（两步定位：ipinfo.io获取IP + ip77.net精确定位）
     * @param {string} ip - IP地址，可选，不传则自动识别
     * @returns {Promise<Object>} 位置信息
     */
    async function getLocation(ip = null) {
        try {
            let userIP = ip;

            // 第一步：如果没有提供IP，使用 ipinfo.io 获取当前IP
            if (!userIP) {
                const ipinfoResponse = await fetch('https://ipinfo.io/json');

                if (!ipinfoResponse.ok) {
                    return {
                        success: false,
                        error: `获取IP失败: ${ipinfoResponse.status}`
                    };
                }

                const ipinfoData = await ipinfoResponse.json();

                if (ipinfoData.error || ipinfoData.bogon) {
                    return {
                        success: false,
                        error: '无法获取IP：内网IP或无效IP'
                    };
                }

                userIP = ipinfoData.ip;
            }

            // 第二步：使用 ip77.net 获取精确的位置信息
            // 构建表单数据（使用 application/x-www-form-urlencoded）
            const formData = new URLSearchParams();
            formData.append('ip', userIP);

            const ip77Response = await fetch('https://api.ip77.net/ip2/v4/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                body: formData.toString()
            });

            if (!ip77Response.ok) {
                return {
                    success: false,
                    error: `精确定位失败: ${ip77Response.status}`
                };
            }

            const ip77Data = await ip77Response.json();

            // 检查返回状态
            if (ip77Data.code !== 0 || !ip77Data.data) {
                return {
                    success: false,
                    error: `精确定位失败: ${ip77Data.message || '未知错误'}`
                };
            }

            const data = ip77Data.data;

            // 检查必需字段
            if (!data.longitude || !data.latitude) {
                return {
                    success: false,
                    error: '定位数据不完整，缺少经纬度'
                };
            }

            // 构建位置坐标（经度,纬度）
            const location = `${data.longitude},${data.latitude}`;

            // 解析位置信息
            const locationInfo = {
                success: true,
                ip: data.ip,
                location: location, // 格式: "经度,纬度"
                country: data.country,
                province: data.province,
                city: data.city,
                district: data.district,
                street: data.street,
                isp: data.isp,
                area_code: data.area_code,
                zip_code: data.zip_code,
                timezone: data.time_zone,
                full_location: data.location, // 完整地址描述
                risk_level: data.risk?.risk_level
            };

            // 缓存位置信息
            cachedLocation = locationInfo;

            return locationInfo;

        } catch (error) {
            console.error('AmapTools.getLocationByIP: 请求失败', error);
            return {
                success: false,
                error: `IP定位失败: ${error.message}`
            };
        }
    }

    /**
     * 获取缓存的位置信息
     * @returns {Object|null}
     */
    function getCachedLocation() {
        return cachedLocation;
    }

    /**
     * 周边搜索 - 搜索附近的美食
     * @param {Object} params - 搜索参数
     * @param {string} [params.location] - 中心点坐标，格式："经度,纬度"。不传则自动通过IP定位获取
     * @param {string} [params.keywords] - 地点关键字，可选
     * @param {string} [params.types] - 指定地点类型，默认"050000"（餐饮服务）
     * @param {number} [params.radius] - 搜索半径（米），取值范围0-50000，默认5000
     * @param {string} [params.sortrule] - 排序规则，"distance"（距离）或"weight"（综合），默认"distance"
     * @param {string} [params.region] - 搜索区划，可选
     * @param {boolean} [params.city_limit] - 是否限制在指定城市内，默认false
     * @param {string} [params.show_fields] - 返回结果控制，可选值如"business,photos,navi"
     * @param {number} [params.page_size] - 每页数据条数，1-25，默认10
     * @param {number} [params.page_num] - 请求第几页，默认1
     * @returns {Promise<Object>} 搜索结果
     */
    async function searchNearby(params = {}) {
        // 参数验证
        if (!params || typeof params !== 'object') {
            return {
                success: false,
                error: '参数格式错误'
            };
        }

        let location = params.location;
        let locationSource = 'user'; // 位置来源：user(用户提供) 或 ip(IP定位)

        // 如果没有提供location，自动通过IP定位获取
        if (!location) {

            // 先尝试使用缓存的位置
            if (cachedLocation && cachedLocation.location) {
                location = cachedLocation.location;
                locationSource = 'ip-cached';
            } else {
                // 进行IP定位
                const ipLocationResult = await getLocation();
                if (!ipLocationResult.success) {
                    return {
                        success: false,
                        error: `无法获取位置信息: ${ipLocationResult.error}`
                    };
                }
                location = ipLocationResult.location;
                locationSource = 'ip';
            }
        }

        // 验证经纬度格式
        const locationParts = location.split(',');
        if (locationParts.length !== 2) {
            return {
                success: false,
                error: 'location 格式错误，应为"经度,纬度"'
            };
        }

        const [lng, lat] = locationParts.map(s => parseFloat(s.trim()));
        if (isNaN(lng) || isNaN(lat)) {
            return {
                success: false,
                error: 'location 包含无效的经纬度值'
            };
        }

        // 验证经纬度范围
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            return {
                success: false,
                error: 'location 经纬度超出有效范围'
            };
        }

        try {
            // 构建请求参数
            const queryParams = new URLSearchParams({
                key: API_KEY,
                location: location  // 使用处理后的location变量，而不是params.location
            });

            // 添加可选参数
            if (params.keywords) {
                queryParams.append('keywords', params.keywords);
            }

            if (params.types) {
                queryParams.append('types', params.types);
            } else {
                // 默认为餐饮服务
                queryParams.append('types', '050000');
            }

            if (params.radius !== undefined) {
                const radius = parseInt(params.radius);
                if (!isNaN(radius) && radius >= 0 && radius <= 50000) {
                    queryParams.append('radius', radius.toString());
                }
            }

            if (params.sortrule) {
                if (['distance', 'weight'].includes(params.sortrule)) {
                    queryParams.append('sortrule', params.sortrule);
                }
            }

            if (params.region) {
                queryParams.append('region', params.region);
            }

            if (params.city_limit !== undefined) {
                queryParams.append('city_limit', params.city_limit ? 'true' : 'false');
            }

            if (params.show_fields) {
                queryParams.append('show_fields', params.show_fields);
            }

            if (params.page_size !== undefined) {
                const pageSize = parseInt(params.page_size);
                if (!isNaN(pageSize) && pageSize >= 1 && pageSize <= 25) {
                    queryParams.append('page_size', pageSize.toString());
                }
            }

            if (params.page_num !== undefined) {
                const pageNum = parseInt(params.page_num);
                if (!isNaN(pageNum) && pageNum >= 1) {
                    queryParams.append('page_num', pageNum.toString());
                }
            }

            // 发起请求
            const apiUrl = `https://restapi.amap.com/v5/place/around?${queryParams.toString()}`;

            const response = await fetch(apiUrl);

            if (!response.ok) {
                return {
                    success: false,
                    error: `HTTP 请求失败: ${response.status} ${response.statusText}`
                };
            }

            const data = await response.json();

            // 检查API返回状态
            if (data.status !== '1') {
                return {
                    success: false,
                    error: `API 错误: ${data.info || '未知错误'}`,
                    infocode: data.infocode
                };
            }

            // 解析POI数据
            const pois = data.pois || [];
            const count = parseInt(data.count) || 0;

            // 格式化返回结果
            const formattedPois = pois.map(poi => {
                const result = {
                    id: poi.id,
                    name: poi.name,
                    type: poi.type,
                    typecode: poi.typecode,
                    address: poi.address,
                    location: poi.location,
                    distance: poi.distance, // 距离（米）
                    pname: poi.pname, // 省份
                    cityname: poi.cityname, // 城市
                    adname: poi.adname, // 区县
                    pcode: poi.pcode,
                    citycode: poi.citycode,
                    adcode: poi.adcode
                };

                // 如果有商业信息，添加进来
                if (poi.business) {
                    result.business = {
                        tel: poi.business.tel,
                        opentime_today: poi.business.opentime_today,
                        opentime_week: poi.business.opentime_week,
                        business_area: poi.business.business_area,
                        tag: poi.business.tag,
                        rating: poi.business.rating,
                        cost: poi.business.cost
                    };
                }

                // 如果有照片信息，添加进来
                if (poi.photos && Array.isArray(poi.photos)) {
                    result.photos = poi.photos.map(photo => ({
                        title: photo.title,
                        url: photo.url
                    }));
                }

                return result;
            });

            // 构建返回消息
            let message = `找到 ${count} 个附近的地点`;
            if (locationSource === 'ip' || locationSource === 'ip-cached') {
                const cityInfo = cachedLocation ?
                    `${cachedLocation.city || cachedLocation.province || '当前位置'}` :
                    '当前位置';
                message = `📍 ${cityInfo} - 找到 ${count} 个附近的地点`;
            }

            return {
                success: true,
                count: count,
                pois: formattedPois,
                location: location,
                locationSource: locationSource,
                locationInfo: locationSource !== 'user' ? cachedLocation : null,
                message: message
            };

        } catch (error) {
            console.error('AmapTools.searchNearby: 请求失败', error);
            return {
                success: false,
                error: `网络请求失败: ${error.message}`
            };
        }
    }

    /**
     * 执行工具函数
     * @param {string} functionName - 函数名称：'searchNearby'
     * @param {Object} args - 函数参数
     * @returns {Promise<Object>|Object} 执行结果或错误信息
     */
    async function executeTool(functionName, args) {
        if (!functionName || typeof functionName !== 'string') {
            console.error('AmapTools.executeTool: 函数名称无效', functionName);
            return { error: '函数名称无效' };
        }

        if (!args || typeof args !== 'object') {
            console.error('AmapTools.executeTool: 参数格式错误', args);
            return { error: '参数格式错误' };
        }

        if (functionName === 'searchNearby') {
            return await searchNearby(args);
        }

        console.error('AmapTools.executeTool: 未知的工具函数', functionName);
        return { error: `未知的工具函数: ${functionName}` };
    }

    // 工具定义
    const toolsDefinition = [
        {
            type: 'function',
            function: {
                name: 'searchNearby',
                description: '搜索附近的美食或其他地点。会自动通过IP定位识别用户位置，无需用户提供。可以根据关键词、类型、距离等条件筛选，返回详细的POI信息包括名称、地址、电话、评分、人均消费等。适用于"附近有什么好吃的"、"周边美食推荐"等场景。',
                parameters: {
                    type: 'object',
                    properties: {
                        location: {
                            type: 'string',
                            description: '中心点坐标，格式为"经度,纬度"。可选，不传则自动通过IP定位获取用户当前位置'
                        },
                        keywords: {
                            type: 'string',
                            description: '搜索关键字，如"火锅"、"川菜"、"咖啡"等，不超过80字符'
                        },
                        types: {
                            type: 'string',
                            description: '地点类型码，默认"050000"（餐饮服务）。多个类型用"|"分隔，如"050100|050200"'
                        },
                        radius: {
                            type: 'number',
                            description: '搜索半径，单位米，取值范围0-50000，默认5000'
                        },
                        sortrule: {
                            type: 'string',
                            description: '排序规则："distance"按距离排序（默认），"weight"综合排序',
                            enum: ['distance', 'weight']
                        },
                        region: {
                            type: 'string',
                            description: '搜索区划，增加指定区域内数据召回权重，可输入行政区划名或citycode/adcode'
                        },
                        city_limit: {
                            type: 'boolean',
                            description: '是否严格限制召回数据在指定区域内，需配合region参数使用，默认false'
                        },
                        show_fields: {
                            type: 'string',
                            description: '指定返回的额外字段，多个字段用逗号分隔，如"business,photos,navi"。business包含营业时间、电话、评分等商业信息'
                        },
                        page_size: {
                            type: 'number',
                            description: '每页返回的数据条数，取值1-25，默认10'
                        },
                        page_num: {
                            type: 'number',
                            description: '请求第几页，默认1'
                        }
                    }
                }
            }
        }
    ];

    // 暴露公共接口
    return {
        getLocation,
        getCachedLocation,
        searchNearby,
        executeTool,
        toolsDefinition
    };
})();
