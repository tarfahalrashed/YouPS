$(document).ready(function() {
    
    var user_name = $.trim($('#user_email').text()),
        btn_login = $("#btn-login"),
        btn_test_run = $("#btn-test-run"),
        btn_code_sumbit = $("#btn-code-submit"),
        btn_incoming_save = $("#btn-incoming-save"),
        btn_shortcut_save = $("#btn-shortcut-save");

    // Disable all the buttons for a while until it is sure that the sure is authenticated
    $(".btn").prop("disabled",true);
    
    var test_mode_msg = {true: "You are currently at test mode. Mailbot will simulate your rule but not actually run the rule.", 
        false: "Mailbot will apply your rules to your incoming emails. "};

    $("#mode-msg").text( test_mode_msg[is_test] );

    // Create the sandbox:
    // window.sandbox = new Sandbox.View({
    //     el : $('#sandbox'),
    //     model : new Sandbox.Model()
    //   });

    // init editor  
    var unsaved_tabs = [];
    
    document.addEventListener("mv-load", function(){   
        document.querySelectorAll('textarea.editor').forEach(function(element) {
            var mode_id = element.id.split("-")[1];
            $('.nav-tabs li a[href="#editor-tab_'+ mode_id +'"]').click();

            var editor = CodeMirror.fromTextArea(element, {
                mode: {name: "python",
                    version: 3,
                    singleLineStringErrors: false},
                lineNumbers: true,
                indentUnit: 4,
                matchBrackets: true
            });

            var arrows = [13, 27, 37, 38, 39, 40];
            editor.on("keyup", function(cm, e) {
                if (arrows.indexOf(e.keyCode) < 0) {
                editor.execCommand("autocomplete")
                }
            });
        });

        var method_names = [];
        document.querySelectorAll('#apis-container h4').forEach(function(element) {
            method_names.push( element.innerHTML.split("(")[0] );
        });

        CodeMirror.registerHelper('hint', 'dictionaryHint', function(editor) {
            var cur = editor.getCursor();
            var curLine = editor.getLine(cur.line);
            var start = cur.ch;
            var end = start;

            while (end < curLine.length && /[\w$]/.test(curLine.charAt(end))) ++end;
            while (start && /[\w$]/.test(curLine.charAt(start - 1))) --start;
            var curWord = start !== end && curLine.slice(start, end);
            var regex = new RegExp('^' + curWord, 'i');

            var suggestion = method_names.filter(function(item) {
                return item.match(regex);
            }).sort();
            suggestion.length == 1 ? suggestion.push(" ") : console.log();

            return {
                list: suggestion,
                from: CodeMirror.Pos(cur.line, start),
                to: CodeMirror.Pos(cur.line, end)
            }
        });

        CodeMirror.commands.autocomplete = function(cm) {
            CodeMirror.showHint(cm, CodeMirror.hint.dictionaryHint);
        };

        // Hide body until editor is ready
        setTimeout(() => {
            $('#loading-wall').hide();
            show_loader(false);
        }, 500);
    });
    

    $(".nav-tabs").on("click", "a", function (e) {
        e.preventDefault();
        if (!$(this).hasClass('add-contact')) {
            $(this).tab('show');
        }
    })
    .on("click", "span.close", function () { // delete tab/mode
        var anchor = $(this).siblings('a');
        $(anchor.attr('href')).remove();
        $(this).parent().remove();
        $(".nav-tabs li").children('a').first().click();

        var mode_id = $(this).siblings('a').attr('href').split("_")[1];
        if( !unsaved_tabs.includes(mode_id) )
            delete_mode( mode_id );
    });

    $('.add-contact').click(function (e) {
        e.preventDefault();
        // TODO get max id of current mode
        var modes = get_modes();
        modes_keys = Object.keys(modes);

        var id = Math.max.apply(null, modes_keys) +1 ; // avoid same ID
        $(this).closest('li').before('<li><a href="#editor-tab_' + id + '"><span class="tab-title" mode-id=' + id + '>New Tab</span><span> ('+ id +')</span><i class="fas fa-pencil-alt"></i></a> <span class="close"> x </span></li>');
        $('.tab-content').append('<div class="tab-pane" id="editor-tab_' + id + '"><textarea class="editor mode-editor" id="editor-' + id + '"></textarea></div>');

        // Move to the just added tab
        $('.nav-tabs li:nth-child(' + ($('.nav-tabs li').length-1) + ') a').click();

        unsaved_tabs.push( id );

        var editor = CodeMirror.fromTextArea(document.getElementById("editor-" + id), {
            mode: {name: "python",
                version: 3,
                singleLineStringErrors: false},
            lineNumbers: true,
            indentUnit: 4,
            matchBrackets: true
        });

        var arrows = [13, 27, 37, 38, 39, 40];
        editor.on("keyup", function(cm, e) {
          if (arrows.indexOf(e.keyCode) < 0) {
            editor.execCommand("autocomplete")
          }
        })
    });

    var editHandler = function() {
      var t = $(this);
      t.css("visibility", "hidden");
      $(this).siblings('.tab-title').attr("contenteditable", "true").focusout(function() {
        $(this).removeAttr("contenteditable").off("focusout");
        t.css("visibility", "visible");
      });
    };
    
    $( "body" ).on( "click", ".nav-tabs .fa-pencil-alt", editHandler);

    // Reload dropdown menu
    $("#current_mode_dropdown").on("click", function() {
        var $ul = $(this).parents(".dropdown").find('.dropdown-menu');
        $ul.empty();

        var modes = get_modes();
        $.each( modes, function( key, value ) {
            $ul.append( '<li><a href="#" data-value="action" mode-id='+ value.id + '>' + value.name + '</a></li>' );
        });
    });

    $("body").on("click", ".dropdown li a", function() {
        $(this).parents(".dropdown").find('.btn').html($(this).text() + ' <span class="caret"></span>');
        $(this).parents(".dropdown").find('.btn').attr('mode-id', $(this).attr('mode-id'));
        $(this).parents(".dropdown").find('.btn').val($(this).data('value'));

        // update current_mode
        run_code( $('#test-mode[type=checkbox]').is(":checked"), get_running());
    })

    var log_backup = "";

    // $("#password-container").hide();
    guess_host($("#user-full-email").text());
    toggle_login_mode();

    if(is_imap_authenticated) {
        fetch_log(); 

        $(".btn").prop("disabled",false);
    }

    if(IS_RUNNING) {
        set_running(true);

        // set dropdown to current mode name if exist
        $(".dropdown .btn").html(current_mode + ' <span class="caret"></span>');
        $(".dropdown .btn").attr('mode-id', current_mode_id);
    } else {
        // init $("#current_mode_dropdown") with a default value if there is no selected mode yet
        var random_id = document.querySelector('.nav.nav-tabs li.active .tab-title').getAttribute('mode-id'),
            random_mode_name = $.trim( document.querySelector('.nav.nav-tabs span[mode-id="'+ random_id + '"]').innerHTML );

        $(".dropdown .btn").html(random_mode_name + ' <span class="caret"></span>');
        $(".dropdown .btn").attr('mode-id', random_id);
    }
    
	$('input[type=radio][name=auth-mode]').change(function() {
        toggle_login_mode();      
    });

    $("#test-mode[type=checkbox]").switchButton({
        labels_placement: "right",
        on_label: 'Test mode',
        off_label: '',
        checked: is_test
    });

    btn_code_sumbit.click(function() {
        if( get_running() ) { // if currently running, then stop 
            run_code( $('#test-mode[type=checkbox]').is(":checked"), false );
        } else run_code( $('#test-mode[type=checkbox]').is(":checked"), true );
        
    });

    btn_incoming_save.click(function() {
        run_code( $('#test-mode[type=checkbox]').is(":checked"), get_running() ); 
    });

    btn_shortcut_save.click(function() {
        save_shortcut();
    })

    $('#test-mode[type=checkbox]').change(function() {
        var want_test = $(this).is(":checked");
        $("#mode-msg").text( test_mode_msg[ want_test ] );
        if(get_running())
            run_code( want_test, true ); 
    });

    function delete_mode( id_to_delete ) {
        var params = {
            'id': id_to_delete
        };

        $.post('/delete_mailbot_mode', params,
            function(res) {
                // $('#donotsend-msg').hide();
                console.log(res);
                
                // Delete success
                if (res.status) {
                    if( id_to_delete == get_current_mode()['id'] ) {
                        set_running(false);
                        $(".dropdown .btn").html("Select your mode" + ' <span class="caret"></span>');
                    }
                        
                }
                else {
                    notify(res, false);
                }
            }
        );
    }

    function show_loader( is_show ) {
        if(is_show) $(".sk-circle").show();
        else $(".sk-circle").hide();
    }
	
	function toggle_login_mode() {
		oauth = $('#rdo-oauth').is(":checked");
		if (oauth) {
            $(".oauth").show();
            $(".plain").hide();
		} else {
			$(".oauth").hide();
            $(".plain").show();
		}
    }

    function get_current_mode() {
        var id = $("#current_mode_dropdown").attr('mode-id'),
            code = document.querySelector('#editor-tab_'+ id +' .CodeMirror').CodeMirror.getValue();

        return {"id": id,
            "name": $.trim(document.querySelector('.nav.nav-tabs li.active .tab-title').innerHTML), 
            "code": code
        };
    }

    function get_modes() {
        var modes = {};

        document.querySelectorAll('.tab-content .CodeMirror').forEach(function(element) { 
            var id = element.parentElement.id.split("_")[1];
            code = element.CodeMirror.getValue(),
            name = document.querySelector('.nav.nav-tabs span[mode-id="'+ id + '"]').innerHTML;

            modes[id] = {
                "id": id,
                "name": $.trim( name ), 
                "code": code
            };
        });

        return modes;
    }

    function get_running() {
        if( btn_code_sumbit.text() == "Disable") return true;
        else return false;
    }

    function set_running(start_running) {
        // Start running
        if(start_running) {
            spinStatusCog(true);
            btn_code_sumbit.text("Disable");
        }
        
        // Stop running
        else {
            spinStatusCog(false);
            btn_code_sumbit.text("Enable");
        }
    }
    
    function spinStatusCog(spin) {
        if(spin) {
            document.querySelector(".fa-sync").classList.add("fa-spin");
            document.querySelector(".idle-mark").style.display = "none";
        }
        else {
            document.querySelector(".fa-sync").classList.remove("fa-spin");
            document.querySelector(".idle-mark").style.display = "inline-block";
        }
    }

    function fetch_log() {
        var params = {};
        
        $.post('/fetch_execution_log', params,
            function(res) {
                // $('#donotsend-msg').hide();
                // console.log(res);
                
                // Auth success
                if (res.status) {
                    if( log_backup != res['imap_log']){
                        $("#console").html("");
                        append_log(res['imap_log'], false);
                    }
                    
                    log_backup = res['imap_log'];
                }
                else {
                    notify(res, false);
                }
            }
        );
        
        setTimeout(fetch_log, 5 * 1000); // 5 second
    }

    function validateEmail(email) {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }    

        btn_login.click(function() {
                show_loader(true);

                var params = {
                    'host': $("#input-host").val(),
                    'password': $('#rdo-oauth').is(":checked") ? $("#input-access-code").val() : $("#input-password").val(),
                    'is_oauth': $('#rdo-oauth').is(":checked")
                };
        
                $.post('/login_imap', params,
                    function(res) {
                        show_loader(false);
                        // $('#donotsend-msg').hide();
                        console.log(res);
                        
                        // Auth success
                        if (res.status) {
                            // Show coding interfaces 
                            $("#login-email-form").hide();
                            $(".btn").prop("disabled",false);

                            if ('imap_code' in res) {
                                editor.setValue( res['imap_code'] );
                                spinStatusCog(true);
                            }
                            
                            append_log(res['imap_log'], false)
                            
                            if (res.code) { 
                                // some emails are not added since they are not members of the group
                                // $('#donotsend-msg').show();
                                // $('#donotsend-msg').html(res['code']);
                            }
                            else {                        
                                notify(res, true);
                            }
                        }
                        else {
                            notify(res, false);
                        }
                    }
                );
        });

        function run_code(is_dry_run, is_running) {
            show_loader(true);

            var cur_mode = get_current_mode();

            var modes = get_modes();

            var params = {
                'current_mode_id': cur_mode['id'],
                'modes': JSON.stringify(modes),
                'email': $("#input-email").val(),
                'test_run': is_dry_run,
                'is_running': is_running
            };

            $.post('/run_mailbot', params,
                function(res) {
                    show_loader(false);
                    console.log(res);
                    
                    // Auth success
                    if (res.status) {
                        
                        // Flush unsaved tags 
                        unsaved_tabs = [];

                        if(res['imap_error'])  {
                            append_log(res['imap_log'], true);

                            set_running(false);   
                        }
                        else {
                            append_log(res['imap_log'], false)

                            set_running(is_running);   
                        }

                        if (res.code) { 
                            // some emails are not added since they are not members of the group
                            // $('#donotsend-msg').show();
                            // $('#donotsend-msg').html(res['code']);
                        }
                        else {                        
                            notify(res, true);
                        }
                    }
                    else {
                        notify(res, false);
                    }
                }
            );
        }

        function save_shortcut() {
            show_loader(true);

            var params = {
                'shortcuts' : document.querySelector('#editor-shortcut-container .CodeMirror').CodeMirror.getValue()
            };

            $.post('/save_shortcut', params,
                function(res) {
                    show_loader(false);
                    console.log(res);
                    
                    // Auth success
                    if (res.status) {

                        if (res.code) { 
                            // some emails are not added since they are not members of the group
                            // $('#donotsend-msg').show();
                            // $('#donotsend-msg').html(res['code']);
                        }
                        else {                        
                            notify(res, true);
                        }
                    }
                    else {
                        notify(res, false);
                    }
                }
            );
        }
    
        $(".default-text").blur();

    function append_log( log, is_error ) {
        if(!log) return;

        var currentdate = new Date();
        var datetime = (currentdate.getMonth()+1) + "/"
            + currentdate.getDate() + "/" 
            + currentdate.getFullYear() + " @ "  
            + currentdate.getHours() + ":"  
            + currentdate.getMinutes() + ":" 
            + currentdate.getSeconds()
            + " | ";

        datetime = '';

        if(is_error) 
            $( "<p>" + datetime + log.replace(/\n/g , "<br>") + "</p>" ).prependTo( "#console" ).addClass("error");

        else $( "<p>" + datetime + log.replace(/\n/g , "<br>") + "</p>" ).prependTo( "#console" )
            .addClass("info");
    }   

    function guess_host( email_addr ) {
        $("#link-less-secure").attr('href', "");
        $("#rdo-oauth").attr('disabled', "");
        
        if( validateEmail(email_addr) ) {
            $("#password-container").show();
            toggle_login_mode();

            if( email_addr.includes("gmail")) {
                $("#input-host").val("imap.gmail.com");
                $("#link-less-secure").attr('href', "https://myaccount.google.com/lesssecureapps");
                $("#rdo-oauth").removeAttr('disabled');

                $(".oauth").show();
            }
            else {
                $(".oauth").remove();

                $("#rdo-plain").not(':checked').prop("checked", true);
                
                if ( email_addr.includes("yahoo")) $("#input-host").val("imap.mail.yahoo.com");
                else if ( email_addr.includes("csail")) $("#input-host").val("imap.csail.mit.edu");
                else if ( email_addr.includes("mit")) $("#input-host").val("imap.exchange.mit.edu");
                else $("#input-host").val("");

                $(".oauth").hide();
            }
        }
        else $("#password-container").hide();
    }

});