1. 同步后可用积分没有刷新(通过中间件)
2. 历史记录应该绑定实例而不是template
3. 修改template后要检查是否应该生成实例(通过中间件)
4. 生成的实例要完全复制template, 并添加templateid
